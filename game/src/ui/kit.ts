import Phaser from 'phaser';

/**
 * Shared visual language for the HUD and overlays — a "naturalist's field
 * notebook at dusk": warm cream ink, muted forest panels, a gold accent.
 * Everything here is drawn (Phaser canvas), so there are no CSS assets.
 */
export const THEME = {
  // text (CSS strings for Text objects)
  ink: '#f4efe0',
  inkMuted: '#a9af96',
  inkFaint: '#6d7360',
  gold: '#f2c879',
  green: '#8fd14f',
  // fills / strokes (numbers for Graphics)
  panelFill: 0x1a2411,
  panelFillSolid: 0x121a0c,
  panelStroke: 0x42552f,
  panelStrokeSoft: 0x2e3c20,
  goldNum: 0xf2c879,
  scrimFill: 0x0c1206,
  // fonts
  sans: '"Avenir Next", "Segoe UI", system-ui, -apple-system, sans-serif',
  serif: 'Georgia, "Iowan Old Style", "Palatino Linotype", serif',
  // rarity
  rarity: { common: '#8fb573', uncommon: '#e6c15a', rare: '#e08a4c' } as Record<string, string>,
} as const;

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Read the device's safe-area insets (notch/home-bar) via a probe element. 0 on desktop. */
export function safeInsets(min = 12): Insets {
  let raw = { top: 0, right: 0, bottom: 0, left: 0 };
  try {
    const d = document.createElement('div');
    d.style.cssText =
      'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';
    document.body.appendChild(d);
    const cs = getComputedStyle(d);
    raw = {
      top: parseFloat(cs.paddingTop) || 0,
      right: parseFloat(cs.paddingRight) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0,
      left: parseFloat(cs.paddingLeft) || 0,
    };
    d.remove();
  } catch {
    /* SSR / probe unavailable */
  }
  return {
    top: raw.top + min,
    right: raw.right + min,
    bottom: raw.bottom + min,
    left: raw.left + min,
  };
}

/** Draw a rounded panel with a subtle border into an existing Graphics object. */
export function drawPanel(
  g: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  opts: { radius?: number; fill?: number; alpha?: number; stroke?: number; x?: number; y?: number } = {}
): void {
  const { radius = 10, fill = THEME.panelFill, alpha = 0.86, stroke = THEME.panelStroke, x = 0, y = 0 } = opts;
  g.fillStyle(fill, alpha);
  g.fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(1, stroke, 0.9);
  g.strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, radius);
}

/** A compact rounded status chip: optional emoji icon + a text value that can update. */
export class Chip {
  readonly container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private padX = 11;
  private padY = 7;

  constructor(scene: Phaser.Scene, x: number, y: number, initial = '') {
    this.bg = scene.add.graphics();
    this.label = scene.add.text(this.padX, this.padY, initial, {
      fontFamily: THEME.sans,
      fontSize: '15px',
      color: THEME.ink,
    });
    this.container = scene.add.container(x, y, [this.bg, this.label]);
    this.redraw();
  }

  setText(s: string): this {
    if (this.label.text !== s) {
      this.label.setText(s);
      this.redraw();
    }
    return this;
  }

  setPosition(x: number, y: number): this {
    this.container.setPosition(x, y);
    return this;
  }

  setVisible(v: boolean): this {
    this.container.setVisible(v);
    return this;
  }

  get width(): number {
    return this.label.width + this.padX * 2;
  }

  private redraw(): void {
    this.bg.clear();
    drawPanel(this.bg, this.label.width + this.padX * 2, this.label.height + this.padY * 2, { radius: 9 });
  }
}

/** A tappable pill button with press feedback and a comfortable touch target. */
export class PillButton {
  readonly container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private w: number;
  private h: number;
  private padX = 14;
  private minH = 40;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, onTap: () => void) {
    this.bg = scene.add.graphics();
    this.label = scene.add
      .text(0, 0, text, { fontFamily: THEME.sans, fontSize: '15px', color: THEME.ink })
      .setOrigin(0.5);
    this.w = this.label.width + this.padX * 2;
    this.h = Math.max(this.minH, this.label.height + 14);
    this.label.setPosition(this.w / 2, this.h / 2);
    this.draw(false);

    this.container = scene.add.container(x, y, [this.bg, this.label]);
    this.container.setSize(this.w, this.h);
    this.container.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, this.w, this.h),
      Phaser.Geom.Rectangle.Contains
    );
    this.container.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      this.draw(true);
    });
    const release = () => this.draw(false);
    this.container.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      this.draw(false);
      onTap();
    });
    this.container.on('pointerout', release);
    this.container.on('pointerupoutside', release);
  }

  setActive(active: boolean): this {
    this.label.setColor(active ? THEME.gold : THEME.ink);
    this.draw(false, active);
    return this;
  }

  get width(): number {
    return this.w;
  }

  setX(x: number): this {
    this.container.setX(x);
    return this;
  }

  private draw(pressed: boolean, active = false): void {
    this.bg.clear();
    drawPanel(this.bg, this.w, this.h, {
      radius: this.h / 2,
      fill: pressed ? 0x2a3a1c : THEME.panelFillSolid,
      alpha: 0.94,
      stroke: active ? THEME.goldNum : THEME.panelStroke,
    });
  }
}
