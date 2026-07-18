import Phaser from 'phaser';
import {
  DESPAWN_MS_MAX,
  DESPAWN_MS_MIN,
  MAX_WILD,
  RARITY_SPAWN_MULT,
  SPAWN_NEAR_TILES,
  SPAWN_TICK_MS,
  ZONE_SPAWN_MULT,
} from '../config/constants';
import { SpeciesDef } from '../config/species-sprites';
import { Creature } from '../entities/Creature';
import { LocationSystem } from './Location';
import { isSpeciesUnlocked, rarityLevelBonus, WELL_FED_OFFSITE_LEVEL } from './Progression';
import { WorldGrid } from './WorldGrid';

export type TimePeriod = 'dawn' | 'day' | 'dusk' | 'night';

export function currentWeek(now = new Date()): number {
  const start = new Date(now.getFullYear(), 0, 1);
  const day = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return Math.min(51, Math.floor(day / 7));
}

export function currentPeriod(now = new Date()): TimePeriod {
  const h = now.getHours();
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 17) return 'day';
  if (h >= 17 && h < 21) return 'dusk';
  return 'night';
}

/**
 * Ticks every ~20s (plan §7). Spawn roll = real week-of-year weight from the
 * iNat histogram × time-of-day gate × rarity × GPS zone bonus. The calendar
 * is the content: the game uses the real Date.
 */
export class Spawner {
  readonly wild: Creature[] = [];
  private scene: Phaser.Scene;
  private grid: WorldGrid;
  private species: SpeciesDef[];
  private location: LocationSystem;
  private getPlayerPos: () => { x: number; y: number };
  private getLevel: () => number;
  // debug overrides so seasonality is testable without waiting for May
  private weekOverride: number | null = null;
  private periodOverride: TimePeriod | null = null;

  constructor(
    scene: Phaser.Scene,
    grid: WorldGrid,
    species: SpeciesDef[],
    location: LocationSystem,
    getPlayerPos: () => { x: number; y: number },
    getLevel: () => number
  ) {
    this.scene = scene;
    this.grid = grid;
    this.species = species;
    this.location = location;
    this.getPlayerPos = getPlayerPos;
    this.getLevel = getLevel;

    const params = new URLSearchParams(window.location.search);
    const w = params.get('week');
    if (w !== null) this.weekOverride = Phaser.Math.Clamp(parseInt(w, 10), 0, 51);
    const p = params.get('period');
    if (p === 'dawn' || p === 'day' || p === 'dusk' || p === 'night') this.periodOverride = p;

    scene.time.addEvent({ delay: SPAWN_TICK_MS, loop: true, callback: () => this.tick() });
    // opening burst so the park isn't empty for the first 20 seconds
    for (let i = 0; i < 5; i++) this.tick(true);
  }

  get week(): number {
    return this.weekOverride ?? currentWeek();
  }

  get period(): TimePeriod {
    return this.periodOverride ?? currentPeriod();
  }

  remove(creature: Creature): void {
    const i = this.wild.indexOf(creature);
    if (i >= 0) this.wild.splice(i, 1);
  }

  update(): void {
    const now = this.scene.time.now;
    for (let i = this.wild.length - 1; i >= 0; i--) {
      const c = this.wild[i];
      if (c.despawnAt > 0 && now > c.despawnAt) {
        this.wild.splice(i, 1);
        c.destroy();
      }
    }
  }

  tick(force = false): void {
    if (this.wild.length >= MAX_WILD) return;
    // zone bonus scales how often a tick actually spawns (2–3× on site, plan §8)
    const zoneMult = ZONE_SPAWN_MULT[this.location.zone] ?? 1;
    if (!force && Math.random() > 0.45 * zoneMult) return;

    const def = this.rollSpecies();
    if (!def) return;
    const tile = this.pickTile(def);
    if (!tile) return;

    const pos = this.grid.toWorld(tile.x, tile.y);
    const creature = new Creature(this.scene, def, pos.x, pos.y);
    creature.despawnAt =
      this.scene.time.now + DESPAWN_MS_MIN + Math.random() * (DESPAWN_MS_MAX - DESPAWN_MS_MIN);
    this.wild.push(creature);
    this.scene.game.events.emit('wild:spawn', creature);
  }

  private rollSpecies(): SpeciesDef | null {
    const week = this.week;
    const period = this.period;
    const level = this.getLevel();
    const candidates: { def: SpeciesDef; w: number }[] = [];
    for (const def of this.species) {
      if (!def.time_of_day.includes(period)) continue;
      if (!isSpeciesUnlocked(def.id, level)) continue;
      // onsite-only species need the real zone, unless the Ramble is well-fed
      // enough (Progression.ts) that word has spread beyond the park.
      if (def.onsite_only && this.location.zone !== 'ramble' && level < WELL_FED_OFFSITE_LEVEL) continue;
      const w =
        def.spawn_weight_by_week[week] * (RARITY_SPAWN_MULT[def.rarity] ?? 1) * rarityLevelBonus(def.rarity, level);
      if (w > 0) candidates.push({ def, w });
    }
    if (candidates.length === 0) return null;
    let total = 0;
    for (const c of candidates) total += c.w;
    let roll = Math.random() * total;
    for (const c of candidates) {
      roll -= c.w;
      if (roll <= 0) return c.def;
    }
    return candidates[candidates.length - 1].def;
  }

  /** Random tile matching the species' habitat tags, preferring near the player. */
  private pickTile(def: SpeciesDef): { x: number; y: number } | null {
    const player = this.getPlayerPos();
    const pt = this.grid.toTile(player.x, player.y);
    const pool: { x: number; y: number }[] = [];
    for (const tag of def.habitat_tags) {
      const tiles = this.grid.habitatTiles.get(tag);
      if (tiles) pool.push(...tiles);
    }
    if (pool.length === 0) return null;

    for (let attempt = 0; attempt < 40; attempt++) {
      const t = pool[Math.floor(Math.random() * pool.length)];
      if (!this.grid.isReachable(t.x, t.y)) continue; // no spawning across an unbuilt bridge
      const d = Math.hypot(t.x - pt.x, t.y - pt.y);
      // near enough to encounter, not so near it pops in on screen
      if (d > 6 && d < SPAWN_NEAR_TILES) return t;
    }
    const reachablePool = pool.filter((t) => this.grid.isReachable(t.x, t.y));
    return reachablePool.length > 0 ? reachablePool[Math.floor(Math.random() * reachablePool.length)] : null;
  }
}
