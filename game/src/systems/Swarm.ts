import {
  SEPARATION_FORCE,
  SEPARATION_RADIUS,
  SLOT_BASE_RADIUS,
  SLOT_GOLDEN_ANGLE,
  SLOT_RADIUS_STEP,
  SPATIAL_HASH_CELL,
  SWARM_CAP_MAX,
} from '../config/constants';
import { Creature } from '../entities/Creature';
import { Player } from '../entities/Player';
import { SWARM_CAP_BY_LEVEL } from './Progression';
import { WorldGrid } from './WorldGrid';

/**
 * Steering, not physics (plan §6): each member seeks a fixed formation slot
 * behind the leader, plus separation from neighbors via a spatial hash.
 * The formation supports SWARM_CAP_MAX slots; the *effective* cap grows
 * with Caretaker Level (Progression.ts) via setCap().
 */
export class Swarm {
  readonly members: Creature[] = [];
  cap = SWARM_CAP_BY_LEVEL[0];
  private slotOffsets: { x: number; y: number }[] = [];
  private hash = new Map<number, Creature[]>();

  constructor() {
    // golden-angle spiral → organic blob instead of a marching grid
    for (let i = 0; i < SWARM_CAP_MAX; i++) {
      const r = SLOT_BASE_RADIUS + SLOT_RADIUS_STEP * Math.sqrt(i) * 2.2;
      const a = i * SLOT_GOLDEN_ANGLE;
      this.slotOffsets.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
  }

  get size(): number {
    return this.members.length;
  }

  get full(): boolean {
    return this.members.length >= this.cap;
  }

  setCap(n: number): void {
    this.cap = Math.max(1, Math.min(SWARM_CAP_MAX, n));
  }

  add(creature: Creature): boolean {
    if (this.full) return false;
    creature.state = 'swarm';
    creature.despawnAt = 0;
    creature.slot = this.firstFreeSlot();
    this.members.push(creature);
    return true;
  }

  remove(creature: Creature): void {
    const i = this.members.indexOf(creature);
    if (i >= 0) this.members.splice(i, 1);
  }

  private firstFreeSlot(): number {
    const used = new Set(this.members.map((m) => m.slot));
    for (let s = 0; s < SWARM_CAP_MAX; s++) if (!used.has(s)) return s;
    return 0;
  }

  /** Nearest member currently following (available to be thrown). */
  nearestFollower(x: number, y: number): Creature | null {
    let best: Creature | null = null;
    let bestD = Infinity;
    for (const m of this.members) {
      if (m.state !== 'swarm') continue;
      const d = Math.hypot(m.x - x, m.y - y);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    return best;
  }

  update(dtMs: number, player: Player, grid: WorldGrid): void {
    // rebuild spatial hash (cell ≈ 2 tiles); no allocation beyond the arrays
    this.hash.clear();
    for (const m of this.members) {
      if (m.state !== 'swarm') continue;
      const key = this.hashKey(m.x, m.y);
      let cell = this.hash.get(key);
      if (!cell) {
        cell = [];
        this.hash.set(key, cell);
      }
      cell.push(m);
    }

    const anchor = player.anchor();
    for (const m of this.members) {
      if (m.state !== 'swarm') continue;
      const slot = this.slotOffsets[m.slot % SWARM_CAP_MAX];
      const { sx, sy } = this.separation(m);
      m.steerToward(anchor.x + slot.x, anchor.y + slot.y, dtMs, grid, sx, sy);
    }
  }

  private hashKey(x: number, y: number): number {
    return Math.floor(x / SPATIAL_HASH_CELL) * 100003 + Math.floor(y / SPATIAL_HASH_CELL);
  }

  private separation(m: Creature): { sx: number; sy: number } {
    let sx = 0;
    let sy = 0;
    const cx = Math.floor(m.x / SPATIAL_HASH_CELL);
    const cy = Math.floor(m.y / SPATIAL_HASH_CELL);
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const cell = this.hash.get((cx + ox) * 100003 + (cy + oy));
        if (!cell) continue;
        for (const other of cell) {
          if (other === m) continue;
          const dx = m.x - other.x;
          const dy = m.y - other.y;
          const d = Math.hypot(dx, dy);
          if (d > 0.001 && d < SEPARATION_RADIUS) {
            const push = (1 - d / SEPARATION_RADIUS) * SEPARATION_FORCE;
            sx += (dx / d) * push;
            sy += (dy / d) * push;
          }
        }
      }
    }
    return { sx, sy };
  }
}
