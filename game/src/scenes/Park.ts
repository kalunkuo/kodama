import Phaser from 'phaser';
import {
  CAPTURE_RANGE,
  TILE_COLORS,
  TILE_SIZE,
  THROW_ARC_HEIGHT,
  THROW_DURATION_MS,
  THROW_RANGE,
  WHISTLE_GROW_RATE,
  WHISTLE_HOLD_MS,
  WHISTLE_MAX_RADIUS,
} from '../config/constants';
import { SpeciesDef } from '../config/species-sprites';
import { CarryObject } from '../entities/CarryObject';
import { Creature } from '../entities/Creature';
import { Player } from '../entities/Player';
import { audio } from '../systems/Audio';
import { LocationSystem } from '../systems/Location';
import { Save } from '../systems/Save';
import { Spawner } from '../systems/Spawner';
import { Swarm } from '../systems/Swarm';
import { TiledMap, WorldGrid } from '../systems/WorldGrid';

const CARRY_TICK_MS = 30_000;
const MAX_CARRY_OBJECTS = 3;

export class Park extends Phaser.Scene {
  grid!: WorldGrid;
  player!: Player;
  swarm!: Swarm;
  spawner!: Spawner;
  save!: Save;
  location!: LocationSystem;
  carryObjects: CarryObject[] = [];
  private base!: { x: number; y: number };
  private pursuit: Creature | null = null;
  private pursuitGoal = { x: 0, y: 0 };
  private captureActive = false;
  // whistle state (press-hold, plan §6)
  private whistling = false;
  private whistleRadius = 0;
  private whistleGfx!: Phaser.GameObjects.Graphics;

  constructor() {
    super('Park');
  }

  create(): void {
    const map = this.cache.json.get('map') as TiledMap;
    this.grid = new WorldGrid(map);
    this.save = new Save();
    this.location = new LocationSystem();
    this.drawGround();

    // spawn on a path tile near the map center; the flag there is "base"
    const start = this.grid.nearestWalkable(
      Math.floor(this.grid.width / 2),
      Math.floor(this.grid.height / 2)
    )!;
    this.base = this.grid.toWorld(start.x, start.y);
    this.add.image(this.base.x, this.base.y - 6, 'flag').setDepth(this.base.y - 1);

    this.player = new Player(this, this.grid, start.x, start.y);
    this.swarm = new Swarm();
    const species = this.registry.get('species') as SpeciesDef[];
    this.spawner = new Spawner(this, this.grid, species, this.location, () => ({
      x: this.player.x,
      y: this.player.y,
    }));

    // restore the saved roster around the player
    for (const id of this.save.data.roster) {
      const def = species.find((s) => s.id === id);
      if (!def || this.swarm.full) continue;
      const c = new Creature(
        this,
        def,
        this.player.x + (Math.random() - 0.5) * 40,
        this.player.y + (Math.random() - 0.5) * 40
      );
      this.swarm.add(c);
    }

    this.whistleGfx = this.add.graphics().setDepth(2_000_000);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.grid.width * TILE_SIZE, this.grid.height * TILE_SIZE);
    cam.setZoom(2.5);
    cam.startFollow(this.player.sprite, true, 0.12, 0.12);

    this.input.on('pointerdown', () => audio.unlock());
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.whistling) {
        this.endWhistle();
        return;
      }
      if (this.captureActive) return;
      // event timestamps, not scene time — taps must survive frame hitches
      const moved = Math.hypot(p.x - p.downX, p.y - p.downY);
      if (moved < 24 && p.upTime - p.downTime < WHISTLE_HOLD_MS) {
        this.handleTap(p.worldX, p.worldY);
      }
    });

    this.game.events.on('capture:done', () => {
      this.captureActive = false;
    });
    this.time.addEvent({ delay: CARRY_TICK_MS, loop: true, callback: () => this.spawnCarryObject() });
    this.spawnCarryObject();
  }

  /** Every 4px-per-tile ground pixel is one map tile; NEAREST scale ×16 keeps it crisp. */
  private drawGround(): void {
    const { width, height } = this.grid;
    const canvasTex = this.textures.createCanvas('ground', width, height)!;
    const ctx = canvasTex.getContext();
    const img = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cls = this.grid.classAt(x, y);
        let color = TILE_COLORS[cls];
        // shoreline highlight: water touching land reads as the Lake's edge
        if (
          cls === 'water' &&
          (this.grid.classAt(x + 1, y) !== 'water' ||
            this.grid.classAt(x - 1, y) !== 'water' ||
            this.grid.classAt(x, y + 1) !== 'water' ||
            this.grid.classAt(x, y - 1) !== 'water')
        ) {
          color = 0x5b89a8;
        }
        // per-tile brightness jitter so large fields don't read as flat plastic
        const jitter = 1 + ((((x * 73856093) ^ (y * 19349663)) % 13) - 6) / 100;
        const i = (y * width + x) * 4;
        img.data[i] = Math.min(255, ((color >> 16) & 0xff) * jitter);
        img.data[i + 1] = Math.min(255, ((color >> 8) & 0xff) * jitter);
        img.data[i + 2] = Math.min(255, (color & 0xff) * jitter);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    canvasTex.refresh();
    canvasTex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.add.image(0, 0, 'ground').setOrigin(0).setScale(TILE_SIZE).setDepth(-1);
  }

  private handleTap(wx: number, wy: number): void {
    // 1. a wild creature → pursue/capture (throw a helper to distract if far)
    const wild = this.wildAt(wx, wy, 34);
    if (wild) {
      const dist = Math.hypot(wild.x - this.player.x, wild.y - this.player.y);
      if (dist <= CAPTURE_RANGE) {
        this.startCapture(wild);
      } else {
        if (dist <= THROW_RANGE && !wild.distracted) {
          const helper = this.swarm.nearestFollower(this.player.x, this.player.y);
          if (helper) this.throwCreature(helper, wild.x, wild.y);
        }
        this.pursuit = wild;
        this.pursuitGoal = { x: wild.x, y: wild.y };
        this.player.setDestination(wild.x, wild.y);
      }
      return;
    }
    // 2. a carry object in throw range → throw a member at it
    const obj = this.carryObjectAt(wx, wy, 22);
    if (obj && !obj.delivered) {
      const dist = Math.hypot(obj.x - this.player.x, obj.y - this.player.y);
      if (dist <= THROW_RANGE) {
        const helper = this.swarm.nearestFollower(this.player.x, this.player.y);
        if (helper) {
          this.throwCreature(helper, obj.x, obj.y);
          return;
        }
      }
    }
    // 3. ground → move
    this.pursuit = null;
    this.player.setDestination(wx, wy);
  }

  private wildAt(wx: number, wy: number, radius: number): Creature | null {
    let best: Creature | null = null;
    let bestD = radius;
    for (const c of this.spawner.wild) {
      const d = Math.hypot(c.x - wx, c.y - wy);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  private carryObjectAt(wx: number, wy: number, radius: number): CarryObject | null {
    for (const o of this.carryObjects) {
      if (Math.hypot(o.x - wx, o.y - wy) < radius) return o;
    }
    return null;
  }

  // ---- verbs ----

  private throwCreature(creature: Creature, tx: number, ty: number): void {
    creature.state = 'thrown';
    audio.pop();
    const sx = creature.x;
    const sy = creature.y;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: THROW_DURATION_MS,
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        creature.sprite.x = sx + (tx - sx) * t;
        creature.sprite.y = sy + (ty - sy) * t - Math.sin(Math.PI * t) * THROW_ARC_HEIGHT;
        creature.sprite.setDepth(creature.sprite.y + THROW_ARC_HEIGHT);
      },
      onComplete: () => this.landThrow(creature, tx, ty),
    });
  }

  private landThrow(creature: Creature, tx: number, ty: number): void {
    if (creature.state !== 'thrown') return; // whistled back mid-air
    // auto-assign to the nearest task in a small radius (plan §6)
    const obj = this.carryObjectAt(tx, ty, 18);
    if (obj && !obj.delivered && obj.attached.length < obj.required) {
      obj.attach(creature, this.grid);
      this.toast(`carrying ${obj.attached.length}/${obj.required}`);
      return;
    }
    const wild = this.wildAt(tx, ty, 20);
    if (wild && !wild.distracted) {
      wild.distracted = true;
      this.toast(`${wild.def.common_name} is distracted!`);
    }
    creature.state = 'swarm';
  }

  private startWhistle(): void {
    this.whistling = true;
    this.whistleRadius = 20;
    this.player.stop();
    this.pursuit = null;
    audio.whistle();
  }

  private endWhistle(): void {
    this.whistling = false;
    this.whistleGfx.clear();
  }

  private updateWhistle(dtMs: number): void {
    this.whistleRadius = Math.min(WHISTLE_MAX_RADIUS, this.whistleRadius + (WHISTLE_GROW_RATE * dtMs) / 1000);
    this.whistleGfx.clear();
    this.whistleGfx.lineStyle(2, 0xffe9a8, 0.9);
    this.whistleGfx.strokeCircle(this.player.x, this.player.y, this.whistleRadius);
    this.whistleGfx.lineStyle(1, 0xffe9a8, 0.35);
    this.whistleGfx.strokeCircle(this.player.x, this.player.y, this.whistleRadius * 0.7);

    // creatures inside break task and return to the swarm (plan §6)
    for (const m of this.swarm.members) {
      if (m.state !== 'working' && m.state !== 'thrown') continue;
      if (Math.hypot(m.x - this.player.x, m.y - this.player.y) > this.whistleRadius) continue;
      for (const o of this.carryObjects) o.detach(m);
      m.state = 'swarm';
    }
  }

  private spawnCarryObject(): void {
    if (this.carryObjects.length >= MAX_CARRY_OBJECTS) return;
    const pt = this.grid.toTile(this.player.x, this.player.y);
    for (let attempt = 0; attempt < 30; attempt++) {
      const tx = pt.x + Math.floor((Math.random() - 0.5) * 50);
      const ty = pt.y + Math.floor((Math.random() - 0.5) * 50);
      const d = Math.hypot(tx - pt.x, ty - pt.y);
      if (d < 8 || !this.grid.isWalkable(tx, ty)) continue;
      const pos = this.grid.toWorld(tx, ty);
      const required = 2 + Math.floor(Math.random() * 3);
      this.carryObjects.push(new CarryObject(this, this.grid, pos.x, pos.y, required, this.base));
      return;
    }
  }

  // ---- capture ----

  private startCapture(creature: Creature): void {
    if (this.captureActive) return;
    this.captureActive = true;
    this.pursuit = null;
    this.player.stop();
    this.game.events.emit('capture:start', {
      speciesDef: creature.def,
      distracted: creature.distracted,
      onResult: (success: boolean) => this.resolveCapture(creature, success),
    });
  }

  private resolveCapture(creature: Creature, success: boolean): void {
    this.captureActive = false;
    creature.distracted = false;
    if (success) {
      this.spawner.remove(creature);
      if (this.swarm.add(creature)) {
        audio.chime();
        this.save.recordCatch(creature.def.id, this.location.zone === 'ramble');
        this.save.setRoster(this.swarm.members.map((m) => m.def.id));
        this.toast(`${creature.def.common_name} joined your swarm!`);
      } else {
        this.save.recordCatch(creature.def.id, this.location.zone === 'ramble');
        this.toast(`${creature.def.common_name} recorded — swarm is full`);
        creature.destroy();
      }
      this.game.events.emit('dex:changed');
    } else {
      audio.fail();
      creature.missCount++;
      if (creature.missCount >= 2) {
        this.spawner.remove(creature);
        creature.destroy();
        this.toast('It slipped away…');
      } else {
        creature.flee(this.player.x, this.player.y, this.time.now);
        this.toast('Missed! It spooked.');
      }
    }
  }

  private pursuitTargetDrift(): number {
    if (!this.pursuit) return 0;
    return Math.hypot(this.pursuit.x - this.pursuitGoal.x, this.pursuit.y - this.pursuitGoal.y);
  }

  private toast(msg: string): void {
    this.game.events.emit('toast', msg);
  }

  update(_time: number, rawDt: number): void {
    // clamp so a long frame (tab hidden, GC) never teleports entities
    const dtMs = Math.min(rawDt, 64);
    // hold long enough without moving → whistle starts
    const ptr = this.input.activePointer;
    if (
      !this.whistling &&
      !this.captureActive &&
      ptr.isDown &&
      this.time.now - ptr.downTime > WHISTLE_HOLD_MS &&
      Math.hypot(ptr.x - ptr.downX, ptr.y - ptr.downY) < 24
    ) {
      this.startWhistle();
    }
    if (this.whistling) this.updateWhistle(dtMs);

    this.player.update(dtMs);
    this.swarm.update(dtMs, this.player, this.grid);
    this.spawner.update();
    for (const c of this.spawner.wild) c.updateWild(dtMs, this.time.now, this.grid);

    for (let i = this.carryObjects.length - 1; i >= 0; i--) {
      const o = this.carryObjects[i];
      if (o.update(dtMs)) {
        for (const m of o.attached) m.state = 'swarm';
        this.carryObjects.splice(i, 1);
        o.destroy();
        this.save.data.offerings++;
        this.save.persist();
        audio.chime();
        this.toast(`Offering delivered! (${this.save.data.offerings} total)`);
      }
    }

    // pursuit: keep chasing until in capture range
    if (this.pursuit && !this.captureActive) {
      if (!this.spawner.wild.includes(this.pursuit)) {
        this.pursuit = null;
      } else {
        const d = Math.hypot(this.pursuit.x - this.player.x, this.pursuit.y - this.player.y);
        if (d <= CAPTURE_RANGE) {
          this.startCapture(this.pursuit);
        } else if (!this.player.moving || this.pursuitTargetDrift() > 24) {
          this.pursuitGoal = { x: this.pursuit.x, y: this.pursuit.y };
          if (!this.player.setDestination(this.pursuit.x, this.pursuit.y)) {
            this.pursuit = null; // unreachable (e.g. mid-water)
          }
        }
      }
    }
  }
}
