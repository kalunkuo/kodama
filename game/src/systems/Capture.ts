import Phaser from 'phaser';
import {
  CAPTURE_BAND,
  CAPTURE_RING_MS,
  CAPTURE_RING_START,
  DISTRACT_BAND_BONUS,
} from '../config/constants';
import { SpeciesDef, tintOf } from '../config/species-sprites';

export interface CaptureRequest {
  speciesDef: SpeciesDef;
  distracted: boolean;
  onResult: (success: boolean) => void;
}

/**
 * One mechanic, data-scaled (plan §7): a ring shrinks toward the creature;
 * tap while it's inside the band. Rarity narrows the band.
 */
export class CaptureGame {
  active = false;
  private scene: Phaser.Scene;
  private gfx: Phaser.GameObjects.Graphics | null = null;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private radius = CAPTURE_RING_START;
  private band = { inner: 0, outer: 0 };
  private request: CaptureRequest | null = null;
  private elapsed = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  start(request: CaptureRequest): void {
    if (this.active) return;
    this.active = true;
    this.request = request;
    this.elapsed = 0;
    this.radius = CAPTURE_RING_START;

    const def = request.speciesDef;
    this.band = { ...CAPTURE_BAND[def.rarity] };
    if (request.distracted) this.band.outer += DISTRACT_BAND_BONUS;

    const { width, height } = this.scene.scale;
    const cx = width / 2;
    const cy = height / 2 - 30;

    const dim = this.scene.add
      .rectangle(0, 0, width, height, 0x000000, 0.55)
      .setOrigin(0)
      .setInteractive();
    dim.on('pointerdown', () => this.tap());
    const creature = this.scene.add
      .image(cx, cy, def.sprite.base)
      .setTint(tintOf(def))
      .setScale(4);
    const name = this.scene.add
      .text(cx, cy + CAPTURE_RING_START + 34, def.common_name, {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#e8e6d8',
      })
      .setOrigin(0.5);
    const hint = this.scene.add
      .text(cx, cy + CAPTURE_RING_START + 58, 'tap when the ring is in the band', {
        fontFamily: 'sans-serif',
        fontSize: '12px',
        color: '#9aa08a',
      })
      .setOrigin(0.5);
    this.gfx = this.scene.add.graphics();
    this.objects = [dim, creature, name, hint, this.gfx];
  }

  update(deltaMs: number): void {
    if (!this.active || !this.gfx || !this.request) return;
    // clamp per-frame time so a hitch (or hidden tab) can't auto-fail the ring
    this.elapsed += Math.min(deltaMs, 64);
    const t = this.elapsed / CAPTURE_RING_MS;
    this.radius = CAPTURE_RING_START * (1 - t);
    if (this.radius <= 0) {
      this.finish(false);
      return;
    }
    const { width, height } = this.scene.scale;
    const cx = width / 2;
    const cy = height / 2 - 30;
    this.gfx.clear();
    // the hit band
    this.gfx.lineStyle(this.band.outer - this.band.inner, 0x8fd14f, 0.28);
    this.gfx.strokeCircle(cx, cy, (this.band.inner + this.band.outer) / 2);
    // the shrinking ring
    const inBand = this.radius >= this.band.inner && this.radius <= this.band.outer;
    this.gfx.lineStyle(3, inBand ? 0xffe9a8 : 0xffffff, 1);
    this.gfx.strokeCircle(cx, cy, this.radius);
  }

  private tap(): void {
    if (!this.active) return;
    const hit = this.radius >= this.band.inner && this.radius <= this.band.outer;
    this.finish(hit);
  }

  private finish(success: boolean): void {
    const req = this.request;
    this.active = false;
    this.request = null;
    for (const o of this.objects) o.destroy();
    this.objects = [];
    this.gfx = null;
    req?.onResult(success);
  }
}
