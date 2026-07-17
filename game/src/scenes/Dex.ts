import Phaser from 'phaser';
import { SpeciesDef, tintOf } from '../config/species-sprites';
import { currentWeek } from '../systems/Spawner';
import { THEME, drawPanel, safeInsets } from '../ui/kit';
import type { Park } from './Park';

const ROW_H = 92;

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
    this.headerH = inset.top + 50;
    const park = this.scene.get('Park') as Park;
    const species = this.registry.get('species') as SpeciesDef[];
    const dex = park.save.data.dex;
    const caught = Object.keys(dex).length;

    const scrim = this.add.rectangle(0, 0, width, height, THEME.scrimFill, 0.97).setOrigin(0).setInteractive();

    // scrolling content (built first so it renders under the header)
    this.content = this.add.container(0, this.headerH).setDepth(1);
    species.forEach((def, i) => this.buildRow(def, dex[def.id], i, width));
    this.maxScroll = Math.max(0, species.length * ROW_H - (height - this.headerH - inset.bottom));

    // fixed header
    const headerBg = this.add.graphics().setDepth(4);
    drawPanel(headerBg, width + 4, this.headerH + 2, {
      x: -2,
      y: -2,
      radius: 0,
      fill: THEME.panelFillSolid,
      alpha: 0.98,
      stroke: THEME.panelStrokeSoft,
    });
    this.add
      .text(inset.left + 4, inset.top + 6, 'Field Guide', {
        fontFamily: THEME.serif,
        fontSize: '24px',
        color: THEME.ink,
      })
      .setDepth(5);
    this.add
      .text(inset.left + 5, inset.top + 32, `${caught} of ${species.length} recorded`, {
        fontFamily: THEME.sans,
        fontSize: '12px',
        color: THEME.inkMuted,
      })
      .setDepth(5);
    const close = this.add
      .text(width - inset.right, inset.top + 4, '✕', {
        fontFamily: THEME.sans,
        fontSize: '24px',
        color: THEME.inkMuted,
      })
      .setOrigin(1, 0)
      .setDepth(5)
      .setInteractive({ useHandCursor: true });
    close.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      this.scene.stop();
    });

    // drag to scroll (tap without drag = no-op)
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
    const y = i * ROW_H;
    const caught = !!entry;

    // card
    const card = this.add.graphics();
    drawPanel(card, width - 20, ROW_H - 10, {
      x: 10,
      y: y + 5,
      radius: 12,
      fill: caught ? THEME.panelFill : THEME.panelFillSolid,
      alpha: caught ? 0.55 : 0.32,
      stroke: caught ? THEME.panelStroke : THEME.panelStrokeSoft,
    });
    this.content.add(card);

    // icon medallion
    const medallion = this.add.graphics();
    medallion.fillStyle(0x0e150a, 0.85);
    medallion.fillCircle(46, y + ROW_H / 2, 24);
    medallion.lineStyle(1, caught ? THEME.panelStroke : THEME.panelStrokeSoft, 1);
    medallion.strokeCircle(46, y + ROW_H / 2, 24);
    const icon = this.add.image(46, y + ROW_H / 2, def.sprite.base).setScale(2.4);
    icon.setTint(caught ? tintOf(def) : 0x11150c);
    this.content.add([medallion, icon]);

    // name + rarity
    const name = this.add.text(82, y + 16, caught ? def.common_name : '???', {
      fontFamily: THEME.serif,
      fontSize: '17px',
      color: caught ? THEME.ink : THEME.inkFaint,
    });
    const dots = { common: '●', uncommon: '● ●', rare: '● ● ●' }[def.rarity];
    const rarity = this.add.text(83, y + 40, dots, {
      fontFamily: THEME.sans,
      fontSize: '9px',
      color: THEME.rarity[def.rarity],
    });
    this.content.add([name, rarity]);

    if (caught) {
      const when = new Date(entry!.caught_at).toLocaleDateString();
      const meta = this.add.text(112, y + 38, entry!.onsite ? `caught ${when}` : `caught ${when}`, {
        fontFamily: THEME.sans,
        fontSize: '11px',
        color: THEME.inkMuted,
      });
      this.content.add(meta);
      if (entry!.onsite) {
        const badge = this.add.text(112 + meta.width + 8, y + 37, '✓ field-verified', {
          fontFamily: THEME.sans,
          fontSize: '11px',
          color: THEME.green,
        });
        this.content.add(badge);
      }
      const blurb = this.add.text(18, y + 60, def.dex_blurb, {
        fontFamily: THEME.sans,
        fontSize: '11px',
        color: '#c3c9b2',
        wordWrap: { width: width - 140 },
      });
      this.content.add(blurb);
    } else {
      const hint = this.add.text(82, y + 58, 'not yet recorded', {
        fontFamily: THEME.sans,
        fontSize: '11px',
        color: THEME.inkFaint,
      });
      this.content.add(hint);
    }

    this.content.add(this.sparkline(def, width - 112, y + 16));
  }

  /** 52-week seasonality sparkline: filled area, line, and a gold marker on the current week. */
  private sparkline(def: SpeciesDef, x: number, y: number): Phaser.GameObjects.Container {
    const W = 92;
    const H = 34;
    const g = this.add.graphics();
    drawPanel(g, W + 12, H + 22, { radius: 8, fill: 0x0e150a, alpha: 0.7, stroke: THEME.panelStrokeSoft });

    const ox = 6;
    const oy = 6;
    const pt = (w: number) => ({ x: ox + (w / 51) * W, y: oy + H - def.spawn_weight_by_week[w] * H });

    // filled area under the curve
    g.fillStyle(0x8fb573, 0.18);
    g.beginPath();
    g.moveTo(ox, oy + H);
    for (let w = 0; w < 52; w++) {
      const p = pt(w);
      g.lineTo(p.x, p.y);
    }
    g.lineTo(ox + W, oy + H);
    g.closePath();
    g.fillPath();

    // line
    g.lineStyle(1.5, 0x9fd07a, 0.95);
    g.beginPath();
    for (let w = 0; w < 52; w++) {
      const p = pt(w);
      if (w === 0) g.moveTo(p.x, p.y);
      else g.lineTo(p.x, p.y);
    }
    g.strokePath();

    // current-week marker
    const cw = currentWeek();
    g.fillStyle(THEME.goldNum, 1);
    g.fillRect(ox + (cw / 51) * W - 1, oy - 2, 2, H + 4);

    const label = this.add.text(ox, oy + H + 4, 'Jan → Dec · now', {
      fontFamily: THEME.sans,
      fontSize: '8px',
      color: THEME.inkFaint,
    });
    return this.add.container(x, y, [g, label]);
  }
}
