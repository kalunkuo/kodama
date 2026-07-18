import Phaser from 'phaser';
import {
  ALERT_DECAY_PER_S,
  ALERT_RADIUS,
  ALERT_RISE_PER_S,
  CREATURE_ACCEL,
  CREATURE_MAX_SPEED,
  FREEZE_MS,
  TILE_SIZE,
} from '../config/constants';
import { SpeciesDef, tintOf } from '../config/species-sprites';
import { WorldGrid } from '../systems/WorldGrid';

export type CreatureState = 'wild' | 'fleeing' | 'swarm' | 'thrown' | 'working';

export class Creature {
  readonly sprite: Phaser.GameObjects.Image;
  readonly def: SpeciesDef;
  state: CreatureState = 'wild';
  vx = 0;
  vy = 0;
  slot = 0; // formation slot index while in the swarm
  missCount = 0; // capture attempts failed (2 misses → despawn, plan §7)
  distracted = false; // a thrown swarm member widens the capture band once
  despawnAt = 0; // scene time; 0 = never (swarm members)
  /** 0..1 — rises when the player rushes it up close, narrows the capture band (idea 3). */
  alertness = 0;
  private scene: Phaser.Scene;
  private wanderAt = 0;
  private wanderTarget: { x: number; y: number } | null = null;
  private fleeUntil = 0;
  private frozenUntil = 0;
  private alertDot: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: Phaser.Scene, def: SpeciesDef, wx: number, wy: number) {
    this.scene = scene;
    this.def = def;
    this.sprite = scene.add.image(wx, wy, def.sprite.base);
    this.sprite.setTint(tintOf(def));
    this.sprite.setDepth(wy);
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  destroy(): void {
    this.sprite.destroy();
    this.alertDot?.destroy();
  }

  flee(fromX: number, fromY: number, sceneTime: number): void {
    this.state = 'fleeing';
    this.alertness = 0;
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    this.wanderTarget = {
      x: this.x + (dx / d) * TILE_SIZE * 4,
      y: this.y + (dy / d) * TILE_SIZE * 4,
    };
    this.fleeUntil = sceneTime + 1200;
  }

  /** Habitat modifier (idea 3): woodland species sometimes freeze on a miss
   * instead of bolting — no chase needed, but the retry is still a real test. */
  freeze(sceneTime: number): void {
    this.wanderTarget = null;
    this.vx = 0;
    this.vy = 0;
    this.frozenUntil = sceneTime + FREEZE_MS;
  }

  get frozen(): boolean {
    return this.frozenUntil > 0;
  }

  /** Rushing up to a wild creature spooks it before you're even in capture range. */
  updateAlertness(dtMs: number, px: number, py: number, playerMoving: boolean, sceneTime: number): void {
    if (this.state !== 'wild' && this.state !== 'fleeing') return;
    const dt = dtMs / 1000;
    const d = Math.hypot(this.x - px, this.y - py);
    if (d < ALERT_RADIUS && playerMoving) {
      this.alertness = Math.min(1, this.alertness + ALERT_RISE_PER_S * dt * (1 - d / ALERT_RADIUS));
    } else {
      this.alertness = Math.max(0, this.alertness - ALERT_DECAY_PER_S * dt);
    }
    if (this.alertness >= 1 && this.state === 'wild') {
      this.flee(px, py, sceneTime);
    }

    if (!this.alertDot) this.alertDot = this.scene.add.graphics().setDepth(1_500_000);
    this.alertDot.clear();
    if (this.alertness > 0.35) {
      this.alertDot.fillStyle(0xf2c879, Math.min(1, (this.alertness - 0.35) / 0.65));
      this.alertDot.fillCircle(this.x, this.y - 12, 2);
    }
  }

  /** Steering integration shared by every state: accelerate toward (tx,ty), stay on land. */
  steerToward(tx: number, ty: number, dtMs: number, grid: WorldGrid, sepX: number, sepY: number, speedScale = 1): void {
    const dt = dtMs / 1000;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    const maxSpeed = CREATURE_MAX_SPEED * speedScale;
    // arrive: ease in over the last ~20px so the swarm settles instead of orbiting
    const desired = dist < 20 ? maxSpeed * (dist / 20) : maxSpeed;
    const dvx = (dist > 0.01 ? (dx / dist) * desired : 0) + sepX;
    const dvy = (dist > 0.01 ? (dy / dist) * desired : 0) + sepY;
    const ax = Phaser.Math.Clamp(dvx - this.vx, -CREATURE_ACCEL * dt, CREATURE_ACCEL * dt);
    const ay = Phaser.Math.Clamp(dvy - this.vy, -CREATURE_ACCEL * dt, CREATURE_ACCEL * dt);
    this.vx += ax;
    this.vy += ay;
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > maxSpeed) {
      this.vx = (this.vx / speed) * maxSpeed;
      this.vy = (this.vy / speed) * maxSpeed;
    }

    let nx = this.x + this.vx * dt;
    let ny = this.y + this.vy * dt;
    // slide along blocked tiles instead of stopping dead
    if (!grid.isWalkableWorld(nx, ny)) {
      if (grid.isWalkableWorld(nx, this.y)) {
        ny = this.y;
        this.vy = 0;
      } else if (grid.isWalkableWorld(this.x, ny)) {
        nx = this.x;
        this.vx = 0;
      } else {
        nx = this.x;
        ny = this.y;
        this.vx = 0;
        this.vy = 0;
      }
    }
    this.sprite.setPosition(nx, ny);
    this.sprite.setDepth(ny);
    if (Math.abs(this.vx) > 4) this.sprite.setFlipX(this.vx < 0);
  }

  /** Idle wander for wild creatures: short hops inside their habitat. */
  updateWild(dtMs: number, sceneTime: number, grid: WorldGrid): void {
    if (this.frozenUntil > 0) {
      if (sceneTime > this.frozenUntil) {
        this.frozenUntil = 0;
        this.sprite.setAlpha(1);
      } else {
        this.sprite.setAlpha(0.65 + 0.35 * Math.abs(Math.sin(sceneTime / 120)));
        return;
      }
    }
    if (this.state === 'fleeing' && sceneTime > this.fleeUntil) {
      this.state = 'wild';
      this.wanderTarget = null;
    }
    if (this.state === 'wild' && sceneTime > this.wanderAt) {
      this.wanderAt = sceneTime + 1800 + Math.random() * 2600;
      const angle = Math.random() * Math.PI * 2;
      const r = TILE_SIZE * (0.5 + Math.random() * 1.5);
      const tx = this.x + Math.cos(angle) * r;
      const ty = this.y + Math.sin(angle) * r;
      this.wanderTarget = grid.isWalkableWorld(tx, ty) || this.def.habitat_tags.includes('water')
        ? { x: tx, y: ty }
        : null;
    }
    if (this.wanderTarget) {
      const speedScale = this.state === 'fleeing' ? 0.9 : 0.25;
      const d = Math.hypot(this.wanderTarget.x - this.x, this.wanderTarget.y - this.y);
      if (d < 3) {
        this.wanderTarget = null;
        this.vx = 0;
        this.vy = 0;
      } else {
        this.steerWildToward(this.wanderTarget.x, this.wanderTarget.y, dtMs, grid, speedScale);
      }
    }
  }

  /** Wild movement ignores land rules for water species (ducks swim). */
  private steerWildToward(tx: number, ty: number, dtMs: number, grid: WorldGrid, speedScale: number): void {
    if (this.def.habitat_tags.includes('water')) {
      const dt = dtMs / 1000;
      const dx = tx - this.x;
      const dy = ty - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      const sp = CREATURE_MAX_SPEED * speedScale;
      const tile = grid.toTile(tx, ty);
      const cls = grid.classAt(tile.x, tile.y);
      if (cls === 'boundary' || cls === 'rock') return;
      this.sprite.x += (dx / dist) * sp * dt;
      this.sprite.y += (dy / dist) * sp * dt;
      this.sprite.setDepth(this.sprite.y);
      if (Math.abs(dx) > 2) this.sprite.setFlipX(dx < 0);
    } else {
      this.steerToward(tx, ty, dtMs, grid, 0, 0, speedScale);
    }
  }
}
