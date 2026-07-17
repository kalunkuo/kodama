import Phaser from 'phaser';
import { TILE_SIZE } from '../config/constants';
import { Creature } from './Creature';
import { WorldGrid } from '../systems/WorldGrid';

const CARRY_SPEED = 40; // px/s — slower than the player, deliberately watchable

/**
 * Carry verb (plan §6): the object declares required N; N thrown creatures
 * attach, then the object A*s back to base with a progress bar.
 */
export class CarryObject {
  readonly sprite: Phaser.GameObjects.Image;
  readonly required: number;
  readonly label: Phaser.GameObjects.Text;
  attached: Creature[] = [];
  delivered = false;
  private path: { x: number; y: number }[] = [];
  private bar: Phaser.GameObjects.Graphics;
  private startDist = 0;
  private base: { x: number; y: number };

  constructor(
    scene: Phaser.Scene,
    grid: WorldGrid,
    wx: number,
    wy: number,
    required: number,
    base: { x: number; y: number }
  ) {
    this.required = required;
    this.base = base;
    this.sprite = scene.add.image(wx, wy, 'acorn');
    this.sprite.setDepth(wy);
    this.label = scene.add
      .text(wx, wy - 12, `0/${required}`, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ffe9a8',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(1_000_000);
    this.bar = scene.add.graphics().setDepth(1_000_000);
    void grid;
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

  attach(creature: Creature, grid: WorldGrid): void {
    if (this.attached.length >= this.required || this.delivered) return;
    creature.state = 'working';
    this.attached.push(creature);
    this.label.setText(`${this.attached.length}/${this.required}`);
    if (this.attached.length >= this.required) {
      const from = grid.toTile(this.x, this.y);
      const to = grid.toTile(this.base.x, this.base.y);
      const fromW = grid.nearestWalkable(from.x, from.y, 6);
      const path = fromW ? grid.findPath(fromW.x, fromW.y, to.x, to.y) : null;
      if (path) {
        this.path = path;
        this.startDist = path.length;
      }
    }
  }

  detach(creature: Creature): void {
    this.attached = this.attached.filter((c) => c !== creature);
    this.label.setText(`${this.attached.length}/${this.required}`);
    if (this.attached.length < this.required) this.path = [];
    this.drawBar();
  }

  /** Returns true when delivered to base this frame. */
  update(dtMs: number): boolean {
    // carriers cluster around the object
    for (let i = 0; i < this.attached.length; i++) {
      const angle = (i / Math.max(1, this.attached.length)) * Math.PI * 2;
      const c = this.attached[i];
      c.sprite.setPosition(this.x + Math.cos(angle) * 9, this.y + Math.sin(angle) * 6);
      c.sprite.setDepth(c.sprite.y);
    }
    this.label.setPosition(this.x, this.y - 14);

    if (this.path.length === 0) return false;
    const dt = dtMs / 1000;
    let remaining = CARRY_SPEED * dt;
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
        remaining = 0;
      }
    }
    this.sprite.setDepth(this.sprite.y);
    this.drawBar();
    if (this.path.length === 0 && Math.hypot(this.x - this.base.x, this.y - this.base.y) < TILE_SIZE * 1.5) {
      this.delivered = true;
      return true;
    }
    return false;
  }

  private drawBar(): void {
    this.bar.clear();
    if (this.startDist === 0 || this.path.length === 0) return;
    const progress = 1 - this.path.length / this.startDist;
    this.bar.fillStyle(0x000000, 0.6).fillRect(this.x - 11, this.y - 24, 22, 4);
    this.bar.fillStyle(0x8fd14f, 1).fillRect(this.x - 10, this.y - 23, 20 * progress, 2);
  }

  destroy(): void {
    this.sprite.destroy();
    this.label.destroy();
    this.bar.destroy();
  }
}
