import Phaser from 'phaser';
import { SpeciesDef, tintOf } from '../config/species-sprites';
import { currentWeek } from '../systems/Spawner';
import { THEME, pixelBox, pixelText, safeInsets } from '../ui/kit';
import type { Park } from './Park';

type Entry = { caught_at: string; onsite: boolean } | undefined;

const COLS = 3;
const GAP = 8;

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * Field guide as a Pokédex grid → tap a cell for the detail card (plan §7:
 * silhouette-until-caught; the real 52-week seasonality is the content).
 */
export class Dex extends Phaser.Scene {
  private species!: SpeciesDef[];
  private dex!: Record<string, { caught_at: string; onsite: boolean }>;
  private inset = { top: 12, right: 12, bottom: 12, left: 12 };
  private headerH = 0;

  private grid!: Phaser.GameObjects.Container;
  private cells: { x: number; y: number; w: number; h: number; index: number }[] = [];
  private cellW = 0;
  private cellH = 116;
  private maxScroll = 0;
  private scrollTop = 0;

  private detail: Phaser.GameObjects.Container | null = null;
  private countLabel!: Phaser.GameObjects.BitmapText;

  private dragging = false;
  private dragStartY = 0;
  private scrollStart = 0;

  constructor() {
    super('Dex');
  }

  create(): void {
    const { width } = this.scale;
    this.inset = safeInsets();
    this.headerH = this.inset.top + 50;
    const park = this.scene.get('Park') as Park;
    this.species = this.registry.get('species') as SpeciesDef[];
    this.dex = park.save.data.dex;

    this.add.rectangle(0, 0, width, this.scale.height, THEME.scrim, 1).setOrigin(0).setDepth(0);

    this.cellW = Math.floor((width - this.inset.left - this.inset.right - GAP * (COLS - 1)) / COLS);
    this.buildGrid();
    this.buildHeader();
    this.bindInput();
  }

  // ---- header ----

  private buildHeader(): void {
    const { width } = this.scale;
    const bar = this.add.graphics().setDepth(10);
    pixelBox(bar, -3, -3, width + 6, this.headerH + 3, { fill: THEME.boxFillDark, alpha: 1 });
    pixelText(this, this.inset.left, this.inset.top + 2, 'FIELD GUIDE', { size: 24, tint: THEME.ink }).setDepth(11);
    this.countLabel = pixelText(this, this.inset.left + 1, this.inset.top + 30, '', {
      size: 8,
      tint: THEME.inkMuted,
    }).setDepth(11);
    this.refreshCount();

    const close = pixelText(this, width - this.inset.right, this.inset.top + 4, 'X', {
      size: 24,
      tint: THEME.inkMuted,
      origin: [1, 0],
    })
      .setDepth(11)
      .setInteractive(new Phaser.Geom.Rectangle(-16, -8, 44, 44), Phaser.Geom.Rectangle.Contains);
    close.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      this.scene.stop();
    });
  }

  private refreshCount(): void {
    const caught = Object.keys(this.dex).length;
    this.countLabel.setText(`${caught} OF ${this.species.length} RECORDED`);
  }

  // ---- grid ----

  private buildGrid(): void {
    this.grid = this.add.container(0, this.headerH + 8).setDepth(1);
    this.cells = [];
    this.species.forEach((def, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = this.inset.left + col * (this.cellW + GAP);
      const y = row * (this.cellH + GAP);
      this.cells.push({ x, y, w: this.cellW, h: this.cellH, index: i });
      this.buildCell(def, this.dex[def.id], i, x, y);
    });
    const rows = Math.ceil(this.species.length / COLS);
    const contentH = rows * (this.cellH + GAP);
    const viewH = this.scale.height - this.headerH - 8 - this.inset.bottom;
    this.maxScroll = Math.max(0, contentH - viewH);
    this.scrollTop = this.headerH + 8;
  }

  private buildCell(def: SpeciesDef, entry: Entry, i: number, x: number, y: number): void {
    const caught = !!entry;
    const box = this.add.graphics();
    pixelBox(box, x, y, this.cellW, this.cellH, {
      fill: caught ? THEME.boxFill : THEME.boxFillDark,
      alpha: caught ? 0.95 : 0.6,
    });
    this.grid.add(box);

    // number, top-left
    this.grid.add(pixelText(this, x + 7, y + 7, `${String(i + 1).padStart(2, '0')}`, { size: 8, tint: THEME.inkFaint }));

    // rarity pips, top-right
    const pipN = { common: 1, uncommon: 2, rare: 3 }[def.rarity];
    const pips = this.add.graphics();
    pips.fillStyle(THEME.rarity[def.rarity], caught ? 1 : 0.6);
    for (let p = 0; p < pipN; p++) pips.fillRect(x + this.cellW - 9 - p * 8, y + 8, 5, 5);
    this.grid.add(pips);

    // icon, centered
    const icon = this.add.image(x + this.cellW / 2, y + this.cellH / 2 - 4, def.sprite.base).setScale(3.4);
    icon.setTint(caught ? tintOf(def) : 0x39432c);
    this.grid.add(icon);

    // name / ??? at the bottom, auto-fit to the cell
    const label = pixelText(this, x + this.cellW / 2, y + this.cellH - 16, caught ? def.common_name : '? ? ?', {
      size: 8,
      tint: caught ? THEME.ink : THEME.inkFaint,
      origin: [0.5, 0],
    });
    const avail = this.cellW - 12;
    if (label.width > avail) label.setFontSize(8 * (avail / label.width));
    this.grid.add(label);
  }

  // ---- detail ----

  private openDetail(index: number): void {
    if (this.detail) return;
    const { width, height } = this.scale;
    const def = this.species[index];
    const entry = this.dex[def.id];
    const caught = !!entry;

    const items: Phaser.GameObjects.GameObject[] = [];
    const bg = this.add.rectangle(0, 0, width, height, THEME.scrim, 1).setOrigin(0).setInteractive();
    items.push(bg);

    const back = pixelText(this, this.inset.left, this.inset.top + 6, '< BACK', { size: 16, tint: THEME.gold })
      .setInteractive(new Phaser.Geom.Rectangle(-12, -14, 130, 52), Phaser.Geom.Rectangle.Contains);
    back.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      this.closeDetail();
    });
    items.push(back);
    const num = pixelText(this, width - this.inset.right, this.inset.top + 8, `#${String(index + 1).padStart(2, '0')}`, {
      size: 16,
      tint: THEME.inkFaint,
      origin: [1, 0],
    });
    items.push(num);

    const cx = width / 2;
    let y = this.inset.top + 54;

    // medallion + icon
    const med = this.add.graphics();
    pixelBox(med, cx - 40, y, 80, 80, { fill: THEME.boxFillDark });
    items.push(med);
    const icon = this.add.image(cx, y + 40, def.sprite.base).setScale(5.5);
    icon.setTint(caught ? tintOf(def) : 0x39432c);
    items.push(icon);
    y += 92;

    // name (auto-fit)
    const name = pixelText(this, cx, y, caught ? def.common_name : '? ? ? ? ?', {
      size: 24,
      tint: caught ? THEME.ink : THEME.inkFaint,
      origin: [0.5, 0],
    });
    const availName = width - this.inset.left - this.inset.right;
    if (name.width > availName) name.setFontSize(24 * (availName / name.width));
    items.push(name);
    y += 30;

    // rarity row
    const rarityLabel = { common: 'COMMON', uncommon: 'UNCOMMON', rare: 'RARE' }[def.rarity];
    const rarity = pixelText(this, cx, y, rarityLabel, { size: 8, tint: THEME.rarity[def.rarity], origin: [0.5, 0] });
    items.push(rarity);
    y += 22;

    // info block, left-aligned
    const lx = this.inset.left + 4;
    const status = caught
      ? `CAUGHT ${new Date(entry!.caught_at).toLocaleDateString()}${entry!.onsite ? '   @ VERIFIED' : ''}`
      : 'NOT YET RECORDED';
    const statusText = pixelText(this, lx, y, status, {
      size: 8,
      tint: caught ? (entry!.onsite ? THEME.green : THEME.inkMuted) : THEME.inkFaint,
    });
    items.push(statusText);
    y += 16;
    items.push(pixelText(this, lx, y, `HABITAT  ${def.habitat_tags.join(' ')}`, { size: 8, tint: THEME.inkMuted }));
    y += 14;
    items.push(pixelText(this, lx, y, `ACTIVE   ${def.time_of_day.join(' ')}`, { size: 8, tint: THEME.inkMuted }));
    y += 20;

    // blurb, wrapped
    if (caught) {
      const blurb = pixelText(this, lx, y, def.dex_blurb, { size: 8, tint: 0xc3c9b2 });
      blurb.setMaxWidth(width - this.inset.left - this.inset.right - 8);
      items.push(blurb);
      y += Math.max(30, blurb.height + 10);
    } else {
      items.push(pixelText(this, lx, y, 'CATCH ONE TO REVEAL ITS FIELD NOTES.', { size: 8, tint: THEME.inkFaint }));
      y += 30;
    }

    // big seasonality sparkline
    const peakWeek = def.spawn_weight_by_week.indexOf(Math.max(...def.spawn_weight_by_week));
    const peakMonth = MONTHS[Math.min(11, Math.floor((peakWeek / 52) * 12))];
    items.push(pixelText(this, lx, y, `SEASONALITY   PEAK ${peakMonth}`, { size: 8, tint: THEME.inkMuted }));
    y += 14;
    items.push(this.bigSparkline(def, lx, y, width - this.inset.left - this.inset.right - 8, 64));

    this.detail = this.add.container(0, 0, items).setDepth(40);
  }

  private closeDetail(): void {
    this.detail?.destroy();
    this.detail = null;
  }

  private bigSparkline(def: SpeciesDef, x: number, y: number, W: number, H: number): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    pixelBox(g, 0, 0, W, H + 16, { fill: THEME.boxFillDark });
    const ox = 8;
    const oy = 8;
    const iw = W - 16;
    const ih = H - 8;
    const pt = (w: number) => ({ x: ox + (w / 51) * iw, y: oy + ih - def.spawn_weight_by_week[w] * ih });

    g.fillStyle(0x8fb573, 0.22);
    g.beginPath();
    g.moveTo(ox, oy + ih);
    for (let w = 0; w < 52; w++) {
      const p = pt(w);
      g.lineTo(p.x, p.y);
    }
    g.lineTo(ox + iw, oy + ih);
    g.closePath();
    g.fillPath();

    g.lineStyle(1.5, 0x9fd07a, 1);
    g.beginPath();
    for (let w = 0; w < 52; w++) {
      const p = pt(w);
      if (w === 0) g.moveTo(p.x, p.y);
      else g.lineTo(p.x, p.y);
    }
    g.strokePath();

    const cw = currentWeek();
    g.fillStyle(THEME.gold, 1);
    g.fillRect(ox + (cw / 51) * iw - 1, oy - 2, 2, ih + 4);

    const children: Phaser.GameObjects.GameObject[] = [g];
    // month ticks: J F M A M J J A S O N D
    for (let m = 0; m < 12; m++) {
      const lx = ox + (m / 11) * iw;
      children.push(pixelText(this, lx, oy + ih + 4, MONTHS[m][0], { size: 8, tint: THEME.inkFaint, origin: [0.5, 0] }));
    }
    return this.add.container(x, y, children);
  }

  // ---- input: drag to scroll grid, tap a cell to open detail ----

  private bindInput(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.detail) return;
      this.dragging = false;
      this.dragStartY = p.y;
      this.scrollStart = this.grid.y;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.detail || !p.isDown) return;
      if (Math.abs(p.y - this.dragStartY) > 5) this.dragging = true;
      const y = this.scrollStart + (p.y - this.dragStartY);
      this.grid.y = Phaser.Math.Clamp(y, this.scrollTop - this.maxScroll, this.scrollTop);
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.detail || this.dragging) return;
      if (p.y < this.headerH) return; // don't catch header taps
      const localY = p.y - this.grid.y;
      const hit = this.cells.find(
        (c) => p.x >= c.x && p.x <= c.x + c.w && localY >= c.y && localY <= c.y + c.h
      );
      if (hit) this.openDetail(hit.index);
    });
  }
}
