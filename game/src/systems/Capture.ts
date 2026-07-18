import Phaser from 'phaser';
import {
  ALERT_BAND_PENALTY,
  CAPTURE_BAND,
  CAPTURE_RING_MS,
  CAPTURE_RING_START,
  DISTRACT_BAND_BONUS,
  STREAK_BAND_BONUS,
  STREAK_CAP,
} from '../config/constants';
import { SpeciesDef, tintOf } from '../config/species-sprites';
import { THEME, pixelText } from '../ui/kit';

export interface CaptureRequest {
  speciesDef: SpeciesDef;
  distracted: boolean;
  /** 0..1, how spooked the creature is from a rushed approach — narrows the band. */
  alertness?: number;
  /** consecutive successful catches so far — widens the band, capped. */
  streak?: number;
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
    // idea 3: a rushed approach narrows the band; a catch streak widens it back
    const alertPenalty = (request.alertness ?? 0) * ALERT_BAND_PENALTY;
    this.band.outer = Math.max(this.band.inner + 8, this.band.outer - alertPenalty);
    this.band.outer += Math.min(request.streak ?? 0, STREAK_CAP) * STREAK_BAND_BONUS;

    const { width, height } = this.scene.scale;
    const cx = width / 2;
    const cy = height / 2 - 30;

    const dim = this.scene.add
      .rectangle(0, 0, width, height, THEME.scrim, 0.6)
      .setOrigin(0)
      .setInteractive();
    dim.on('pointerdown', () => this.tap());
    const rarityColor = THEME.rarity[def.rarity];
    const halo = this.scene.add.graphics();
    halo.fillStyle(rarityColor, 0.1).fillCircle(cx, cy, CAPTURE_RING_START + 8);
    const creature = this.scene.add
      .image(cx, cy, def.sprite.base)
      .setTint(tintOf(def))
      .setScale(4);
    const name = pixelText(this.scene, cx, cy + CAPTURE_RING_START + 44, def.common_name, {
      size: 24,
      tint: THEME.ink,
      origin: 0.5,
    });
    const hint = pixelText(this.scene, cx, cy + CAPTURE_RING_START + 72, 'TAP WHEN THE RING MEETS THE BAND', {
      size: 8,
      tint: THEME.inkMuted,
      origin: 0.5,
    });
    this.gfx = this.scene.add.graphics();
    this.objects = [dim, halo, creature, name, hint, this.gfx];
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
    const inBand = this.radius >= this.band.inner && this.radius <= this.band.outer;
    this.gfx.lineStyle(this.band.outer - this.band.inner, 0x8fd14f, inBand ? 0.42 : 0.26);
    this.gfx.strokeCircle(cx, cy, (this.band.inner + this.band.outer) / 2);
    // the shrinking ring — glows gold when it's over the band
    if (inBand) {
      this.gfx.lineStyle(7, 0xffe9a8, 0.25);
      this.gfx.strokeCircle(cx, cy, this.radius);
    }
    this.gfx.lineStyle(3, inBand ? 0xffe9a8 : 0xf4efe0, 1);
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
