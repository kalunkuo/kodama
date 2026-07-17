import Phaser from 'phaser';
import { SpeciesDef, tintOf } from '../config/species-sprites';
import { currentWeek } from '../systems/Spawner';
import { THEME, pixelBox, pixelText, safeInsets } from '../ui/kit';
import type { Park } from './Park';

const ROW_H = 96;

/**
 * Silhouette-until-caught (plan §7). Each entry shows the species' real
 * 52-week seasonality as a sparkline — "only findable in May" IS the content.
 */
export class Dex extends Phaser.Scene {
  private content!: Phaser.GameObjects.Container;
  private dragStartY = 0;
  private scrollStart = 0;
  private maxScroll = 0;
  private headerH = 0;

  constructor() {
    super('Dex');
  }

  create(): void {
    const { width, height } = this.scale;
    const inset = safeInsets();
    this.headerH = inset.top + 52;
    const park = this.scene.get('Park') as Park;
    const species = this.registry.get('species') as SpeciesDef[];
    const dex = park.save.data.dex;
    const caught = Object.keys(dex).length;

    const scrim = this.add.rectangle(0, 0, width, height, THEME.scrim, 1).setOrigin(0).setInteractive();

    this.content = this.add.container(0, this.headerH).setDepth(1);
    species.forEach((def, i) => this.buildRow(def, dex[def.id], i, width));
    this.maxScroll = Math.max(0, species.length * ROW_H + 10 - (height - this.headerH - inset.bottom));

    // fixed header
    const headerBg = this.add.graphics().setDepth(4);
    pixelBox(headerBg, -3, -3, width + 6, this.headerH + 3, { fill: THEME.boxFillDark, alpha: 0.99 });
    pixelText(this, inset.left + 4, inset.top + 4, 'FIELD GUIDE', { size: 24, tint: THEME.ink }).setDepth(5);
    pixelText(this, inset.left + 5, inset.top + 32, `${caught} OF ${species.length} RECORDED`, {
      size: 8,
      tint: THEME.inkMuted,
    }).setDepth(5);
    const close = pixelText(this, width - inset.right - 4, inset.top + 6, 'X', { size: 24, tint: THEME.inkMuted, origin: [1, 0] })
      .setDepth(5)
      .setInteractive(new Phaser.Geom.Rectangle(-14, -8, 40, 40), Phaser.Geom.Rectangle.Contains);
    close.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      this.scene.stop();
    });

    scrim.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragStartY = p.y;
      this.scrollStart = this.content.y;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      const y = this.scrollStart + (p.y - this.dragStartY);
      this.content.y = Phaser.Math.Clamp(y, this.headerH - this.maxScroll, this.headerH);
    });
  }

  private buildRow(def: SpeciesDef, entry: { caught_at: string; onsite: boolean } | undefined, i: number, width: number): void {
    const y = i * ROW_H + 6;
    const caught = !!entry;

    const card = this.add.graphics();
    pixelBox(card, 8, y, width - 16, ROW_H - 12, {
      fill: caught ? THEME.boxFill : THEME.boxFillDark,
      alpha: caught ? 0.9 : 0.6,
    });
    this.content.add(card);

    // square medallion + icon
    const medX = 18;
    const medY = y + 14;
    const med = this.add.graphics();
    pixelBox(med, medX, medY, 44, 44, { fill: THEME.boxFillDark });
    const icon = this.add.image(medX + 22, medY + 22, def.sprite.base).setScale(2.6);
    icon.setTint(caught ? tintOf(def) : 0x39432c); // faint silhouette until caught
    this.content.add([med, icon]);

    // name — one line, auto-shrunk if a long name would reach the sparkline
    const name = pixelText(this, 74, y + 14, caught ? def.common_name : '? ? ?', {
      size: 12,
      tint: caught ? THEME.ink : THEME.inkFaint,
    });
    const avail = width - 116 - 74 - 4;
    if (name.width > avail) name.setFontSize(12 * (avail / name.width));
    this.content.add(name);

    // rarity pips
    const pipN = { common: 1, uncommon: 2, rare: 3 }[def.rarity];
    const pips = this.add.graphics();
    pips.fillStyle(THEME.rarity[def.rarity], 1);
    for (let p = 0; p < pipN; p++) pips.fillRect(75 + p * 8, y + 34, 5, 5);
    this.content.add(pips);

    if (caught) {
      const when = new Date(entry!.caught_at).toLocaleDateString();
      const meta = pixelText(this, 92, y + 33, `CAUGHT ${when}`, { size: 8, tint: THEME.inkMuted });
      this.content.add(meta);
      if (entry!.onsite) {
        const badge = pixelText(this, 92 + meta.width + 8, y + 33, '@ VERIFIED', { size: 8, tint: THEME.green });
        this.content.add(badge);
      }
      const blurb = pixelText(this, 16, y + 52, def.dex_blurb, { size: 8, tint: 0xc3c9b2 });
      blurb.setMaxWidth(width - 140);
      this.content.add(blurb);
    } else {
      const note = pixelText(this, 74, y + 50, 'NOT YET RECORDED', { size: 8, tint: THEME.inkFaint });
      this.content.add(note);
    }

    this.content.add(this.sparkline(def, width - 116, y + 10));
  }

  /** 52-week seasonality sparkline: filled area, line, and a gold marker on the current week. */
  private sparkline(def: SpeciesDef, x: number, y: number): Phaser.GameObjects.Container {
    const W = 96;
    const H = 34;
    const g = this.add.graphics();
    pixelBox(g, 0, 0, W + 12, H + 24, { fill: THEME.boxFillDark });

    const ox = 6;
    const oy = 6;
    const pt = (w: number) => ({ x: ox + (w / 51) * W, y: oy + H - def.spawn_weight_by_week[w] * H });

    g.fillStyle(0x8fb573, 0.2);
    g.beginPath();
    g.moveTo(ox, oy + H);
    for (let w = 0; w < 52; w++) {
      const p = pt(w);
      g.lineTo(p.x, p.y);
    }
    g.lineTo(ox + W, oy + H);
    g.closePath();
    g.fillPath();

    g.lineStyle(1.5, 0x9fd07a, 0.95);
    g.beginPath();
    for (let w = 0; w < 52; w++) {
      const p = pt(w);
      if (w === 0) g.moveTo(p.x, p.y);
      else g.lineTo(p.x, p.y);
    }
    g.strokePath();

    const cw = currentWeek();
    g.fillStyle(THEME.gold, 1);
    g.fillRect(ox + (cw / 51) * W - 1, oy - 2, 2, H + 4);

    const label = pixelText(this, ox, oy + H + 5, 'JAN > DEC', { size: 8, tint: THEME.inkFaint });
    return this.add.container(x, y, [g, label]);
  }
}
