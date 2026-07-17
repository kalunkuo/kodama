import Phaser from 'phaser';
import { SpeciesDef, tintOf } from '../config/species-sprites';
import { currentWeek } from '../systems/Spawner';
import type { Park } from './Park';

const FONT = 'sans-serif';
const ROW_H = 86;

/**
 * Silhouette-until-caught (plan §7). Each entry shows the species' real
 * 52-week seasonality as a sparkline — "only findable in May" IS the content.
 */
export class Dex extends Phaser.Scene {
  private container!: Phaser.GameObjects.Container;
  private dragStartY = 0;
  private scrollStart = 0;
  private maxScroll = 0;

  constructor() {
    super('Dex');
  }

  create(): void {
    const { width, height } = this.scale;
    const park = this.scene.get('Park') as Park;
    const species = this.registry.get('species') as SpeciesDef[];
    const dex = park.save.data.dex;
    const caughtCount = Object.keys(dex).length;

    const bg = this.add.rectangle(0, 0, width, height, 0x121708, 0.96).setOrigin(0).setInteractive();
    this.add
      .text(16, 14, `Field Guide — ${caughtCount}/${species.length}`, {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#e8e6d8',
      })
      .setDepth(2);
    const close = this.add
      .text(width - 16, 14, '✕', { fontFamily: FONT, fontSize: '22px', color: '#e8e6d8' })
      .setOrigin(1, 0)
      .setDepth(2)
      .setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.scene.stop());

    this.container = this.add.container(0, 52);
    species.forEach((def, i) => this.buildRow(def, dex[def.id], i));
    this.maxScroll = Math.max(0, species.length * ROW_H - (height - 60));

    // drag to scroll
    bg.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragStartY = p.y;
      this.scrollStart = this.container.y;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      const y = this.scrollStart + (p.y - this.dragStartY);
      this.container.y = Phaser.Math.Clamp(y, 52 - this.maxScroll, 52);
    });
  }

  private buildRow(def: SpeciesDef, entry: { caught_at: string; onsite: boolean } | undefined, i: number): void {
    const y = i * ROW_H;
    const { width } = this.scale;
    const caught = !!entry;

    const icon = this.add.image(34, y + 30, def.sprite.base).setScale(2.6);
    icon.setTint(caught ? tintOf(def) : 0x000000);

    const name = this.add.text(66, y + 10, caught ? def.common_name : '???', {
      fontFamily: FONT,
      fontSize: '16px',
      color: caught ? '#e8e6d8' : '#6a705c',
    });
    const rarityDots = { common: '●', uncommon: '●●', rare: '●●●' }[def.rarity];
    const rarity = this.add.text(66, y + 30, rarityDots, {
      fontFamily: FONT,
      fontSize: '10px',
      color: { common: '#8fb573', uncommon: '#d9b552', rare: '#d97452' }[def.rarity],
    });
    this.container.add([icon, name, rarity]);

    if (caught) {
      const when = new Date(entry.caught_at).toLocaleDateString();
      const badge = entry.onsite ? '  ✓ field-verified' : '';
      const meta = this.add.text(66, y + 44, `caught ${when}${badge}`, {
        fontFamily: FONT,
        fontSize: '11px',
        color: entry.onsite ? '#8fd14f' : '#9aa08a',
      });
      const blurb = this.add.text(16, y + 62, def.dex_blurb, {
        fontFamily: FONT,
        fontSize: '11px',
        color: '#b9bfa8',
        wordWrap: { width: width - 130 },
      });
      this.container.add([meta, blurb]);
    }

    this.container.add(this.sparkline(def, width - 106, y + 14));
    const line = this.add
      .rectangle(8, y + ROW_H - 4, width - 16, 1, 0x2c3626)
      .setOrigin(0);
    this.container.add(line);
  }

  /** 52-week seasonality sparkline with a marker on the current real week. */
  private sparkline(def: SpeciesDef, x: number, y: number): Phaser.GameObjects.Graphics {
    const W = 90;
    const H = 26;
    const g = this.add.graphics({ x, y });
    g.fillStyle(0x000000, 0.35);
    g.fillRect(-4, -4, W + 8, H + 8);
    g.lineStyle(1, 0x8fb573, 0.9);
    g.beginPath();
    for (let w = 0; w < 52; w++) {
      const vx = (w / 51) * W;
      const vy = H - def.spawn_weight_by_week[w] * H;
      if (w === 0) g.moveTo(vx, vy);
      else g.lineTo(vx, vy);
    }
    g.strokePath();
    const cw = currentWeek();
    g.fillStyle(0xffe9a8, 1);
    g.fillRect((cw / 51) * W - 1, -2, 2, H + 4);
    return g;
  }
}
