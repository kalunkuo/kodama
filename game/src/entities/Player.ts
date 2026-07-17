import Phaser from 'phaser';
import { PLAYER_SPEED, SWARM_ANCHOR_TRAIL } from '../config/constants';
import { WorldGrid } from '../systems/WorldGrid';

export class Player {
  readonly sprite: Phaser.GameObjects.Image;
  facingX = 0;
  facingY = 1;
  private path: { x: number; y: number }[] = [];
  private grid: WorldGrid;

  constructor(scene: Phaser.Scene, grid: WorldGrid, tx: number, ty: number) {
    this.grid = grid;
    const pos = grid.toWorld(tx, ty);
    this.sprite = scene.add.image(pos.x, pos.y, 'player');
    this.sprite.setOrigin(0.5, 0.85);
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  get moving(): boolean {
    return this.path.length > 0;
  }

  /** Tap-to-move (plan §6): A* to the tapped tile, snapping to nearest walkable. */
  setDestination(wx: number, wy: number): boolean {
    const from = this.grid.toTile(this.x, this.y);
    const rawTo = this.grid.toTile(wx, wy);
    const to = this.grid.nearestWalkable(rawTo.x, rawTo.y, 12);
    if (!to) return false;
    const path = this.grid.findPath(from.x, from.y, to.x, to.y);
    if (!path) return false;
    this.path = path;
    return true;
  }

  stop(): void {
    this.path = [];
  }

  update(dtMs: number): void {
    if (this.path.length === 0) return;
    const dt = dtMs / 1000;
    let remaining = PLAYER_SPEED * dt;
    while (remaining > 0 && this.path.length > 0) {
      const next = this.path[0];
      const dx = next.x - this.sprite.x;
      const dy = next.y - this.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= remaining) {
        this.sprite.setPosition(next.x, next.y);
        this.path.shift();
        remaining -= dist;
      } else {
        this.sprite.x += (dx / dist) * remaining;
        this.sprite.y += (dy / dist) * remaining;
        this.facingX = dx / dist;
        this.facingY = dy / dist;
        remaining = 0;
      }
    }
    this.sprite.setDepth(this.sprite.y);
  }

  /** Point behind the player the swarm forms around. */
  anchor(): { x: number; y: number } {
    return {
      x: this.x - this.facingX * SWARM_ANCHOR_TRAIL,
      y: this.y - this.facingY * SWARM_ANCHOR_TRAIL,
    };
  }
}
