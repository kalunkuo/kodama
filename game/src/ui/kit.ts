import Phaser from 'phaser';

/**
 * Pixel-art UI to match the game's sprites: a procedurally-built 5x7 bitmap
 * font (RetroFont) and chunky beveled window-boxes. No CSS/font assets — the
 * whole look is drawn, so it stays crisp and fully offline.
 */
export const FONT_KEY = 'pixel';

export const THEME = {
  ink: 0xf4efe0,
  inkMuted: 0xa9af96,
  inkFaint: 0x6d7360,
  gold: 0xf2c879,
  green: 0x8fd14f,
  boxFill: 0x1b2712,
  boxFillDark: 0x101a0a,
  boxLight: 0x4a5c34,
  boxDark: 0x0a1006,
  scrim: 0x0c1206,
  rarity: { common: 0x8fb573, uncommon: 0xe6c15a, rare: 0xe08a4c } as Record<string, number>,
} as const;

// 5x7 glyphs, '#' = on. Uppercase-only (a retro convention); text is upcased
// on the way in, so both cases render from one glyph.
const G: Record<string, string[]> = {
  ' ': ['     ', '     ', '     ', '     ', '     ', '     ', '     '],
  A: [' ### ', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
  B: ['#### ', '#   #', '#   #', '#### ', '#   #', '#   #', '#### '],
  C: [' ####', '#    ', '#    ', '#    ', '#    ', '#    ', ' ####'],
  D: ['#### ', '#   #', '#   #', '#   #', '#   #', '#   #', '#### '],
  E: ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#####'],
  F: ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#    '],
  G: [' ####', '#    ', '#    ', '#  ##', '#   #', '#   #', ' ####'],
  H: ['#   #', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
  I: ['#####', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '#####'],
  J: ['  ###', '   # ', '   # ', '   # ', '#  # ', '#  # ', ' ##  '],
  K: ['#   #', '#  # ', '# #  ', '##   ', '# #  ', '#  # ', '#   #'],
  L: ['#    ', '#    ', '#    ', '#    ', '#    ', '#    ', '#####'],
  M: ['#   #', '## ##', '# # #', '#   #', '#   #', '#   #', '#   #'],
  N: ['#   #', '##  #', '# # #', '#  ##', '#   #', '#   #', '#   #'],
  O: [' ### ', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
  P: ['#### ', '#   #', '#   #', '#### ', '#    ', '#    ', '#    '],
  Q: [' ### ', '#   #', '#   #', '#   #', '# # #', '#  # ', ' ## #'],
  R: ['#### ', '#   #', '#   #', '#### ', '# #  ', '#  # ', '#   #'],
  S: [' ####', '#    ', '#    ', ' ### ', '    #', '    #', '#### '],
  T: ['#####', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '  #  '],
  U: ['#   #', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
  V: ['#   #', '#   #', '#   #', '#   #', '#   #', ' # # ', '  #  '],
  W: ['#   #', '#   #', '#   #', '# # #', '# # #', '## ##', '#   #'],
  X: ['#   #', '#   #', ' # # ', '  #  ', ' # # ', '#   #', '#   #'],
  Y: ['#   #', '#   #', ' # # ', '  #  ', '  #  ', '  #  ', '  #  '],
  Z: ['#####', '    #', '   # ', '  #  ', ' #   ', '#    ', '#####'],
  '0': [' ### ', '#   #', '#  ##', '# # #', '##  #', '#   #', ' ### '],
  '1': ['  #  ', ' ##  ', '  #  ', '  #  ', '  #  ', '  #  ', '#####'],
  '2': [' ### ', '#   #', '    #', '   # ', '  #  ', ' #   ', '#####'],
  '3': ['#####', '   # ', '  #  ', '   # ', '    #', '#   #', ' ### '],
  '4': ['   # ', '  ## ', ' # # ', '#  # ', '#####', '   # ', '   # '],
  '5': ['#####', '#    ', '#### ', '    #', '    #', '#   #', ' ### '],
  '6': [' ### ', '#    ', '#    ', '#### ', '#   #', '#   #', ' ### '],
  '7': ['#####', '    #', '   # ', '  #  ', ' #   ', ' #   ', ' #   '],
  '8': [' ### ', '#   #', '#   #', ' ### ', '#   #', '#   #', ' ### '],
  '9': [' ### ', '#   #', '#   #', ' ####', '    #', '    #', ' ### '],
  '.': ['     ', '     ', '     ', '     ', '     ', ' ##  ', ' ##  '],
  ',': ['     ', '     ', '     ', '     ', ' ##  ', ' ##  ', '#    '],
  '!': ['  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '     ', '  #  '],
  '?': [' ### ', '#   #', '    #', '   # ', '  #  ', '     ', '  #  '],
  "'": ['  #  ', '  #  ', ' #   ', '     ', '     ', '     ', '     '],
  ':': ['     ', ' ##  ', ' ##  ', '     ', ' ##  ', ' ##  ', '     '],
  '-': ['     ', '     ', '     ', '#####', '     ', '     ', '     '],
  '+': ['     ', '  #  ', '  #  ', '#####', '  #  ', '  #  ', '     '],
  '/': ['    #', '    #', '   # ', '  #  ', ' #   ', '#    ', '#    '],
  '(': ['   # ', '  #  ', ' #   ', ' #   ', ' #   ', '  #  ', '   # '],
  ')': [' #   ', '  #  ', '   # ', '   # ', '   # ', '  #  ', ' #   '],
  x: ['     ', '     ', '#   #', ' # # ', '  #  ', ' # # ', '#   #'], // multiply sign
  '*': ['     ', '     ', '     ', ' ##  ', ' ##  ', '     ', '     '], // middot
  '>': ['     ', '  #  ', '   # ', '#####', '   # ', '  #  ', '     '], // arrow
  '<': ['     ', '  #  ', ' #   ', '#####', ' #   ', '  #  ', '     '], // back arrow
  '@': ['     ', '    #', '    #', '#  # ', '# #  ', '##   ', ' #   '], // check
};

let built = false;

/** Build the RetroFont once from the glyph table. Call in Preload. */
export function buildPixelFont(scene: Phaser.Scene): void {
  if (built || scene.cache.bitmapFont.exists(FONT_KEY)) {
    built = true;
    return;
  }
  const chars = Object.keys(G).join('');
  const perRow = 16;
  const cw = 6;
  const ch = 8;
  const rows = Math.ceil(chars.length / perRow);

  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 1);
  chars.split('').forEach((c, i) => {
    const gx = (i % perRow) * cw;
    const gy = Math.floor(i / perRow) * ch;
    const data = G[c];
    for (let ry = 0; ry < 7; ry++) {
      const line = data[ry] || '';
      for (let rx = 0; rx < 5; rx++) {
        if (line[rx] === '#') g.fillRect(gx + rx, gy + ry, 1, 1);
      }
    }
  });
  g.generateTexture('pixelfont', perRow * cw, rows * ch);
  g.destroy();
  scene.textures.get('pixelfont').setFilter(Phaser.Textures.FilterMode.NEAREST);

  const config: Phaser.Types.GameObjects.BitmapText.RetroFontConfig = {
    image: 'pixelfont',
    width: cw,
    height: ch,
    chars,
    charsPerRow: perRow,
    'spacing.x': 0,
    'spacing.y': 0,
    'offset.x': 0,
    'offset.y': 0,
    lineSpacing: 2,
  };
  scene.cache.bitmapFont.add(FONT_KEY, Phaser.GameObjects.RetroFont.Parse(scene, config));
  built = true;
}

// map characters we lack to the substitute glyph drawn above
function normalize(s: string): string {
  return s
    .toUpperCase()
    .replace(/×/g, 'x')
    .replace(/·/g, '*')
    .replace(/→/g, '>')
    .replace(/✓/g, '@')
    .replace(/…/g, '...')
    .replace(/["“”]/g, "'");
}

export interface PixelTextOpts {
  size?: number; // display height in px (multiples of 8 stay crisp: 8, 16, 24)
  tint?: number;
  origin?: number | [number, number];
}

export function pixelText(scene: Phaser.Scene, x: number, y: number, text: string, opts: PixelTextOpts = {}): Phaser.GameObjects.BitmapText {
  const { size = 16, tint = THEME.ink, origin } = opts;
  const bt = scene.add.bitmapText(x, y, FONT_KEY, normalize(text), size);
  bt.setTint(tint);
  if (origin !== undefined) {
    if (Array.isArray(origin)) bt.setOrigin(origin[0], origin[1]);
    else bt.setOrigin(origin);
  }
  return bt;
}

export function setPixelText(bt: Phaser.GameObjects.BitmapText, text: string): void {
  bt.setText(normalize(text));
}

/** Chunky beveled window-box drawn at integer coords (crisp under pixelArt). */
export function pixelBox(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { fill?: number; alpha?: number; pressed?: boolean; accent?: number } = {}
): void {
  const { fill = THEME.boxFill, alpha = 0.95, pressed = false, accent } = opts;
  const X = Math.round(x);
  const Y = Math.round(y);
  const W = Math.round(w);
  const H = Math.round(h);
  // hard 2px outer border
  g.fillStyle(accent ?? THEME.boxDark, 1);
  g.fillRect(X, Y, W, H);
  // fill
  g.fillStyle(fill, alpha);
  g.fillRect(X + 2, Y + 2, W - 4, H - 4);
  // 1px bevel: light top-left, dark bottom-right (inverted when pressed)
  const light = pressed ? THEME.boxDark : THEME.boxLight;
  const dark = pressed ? THEME.boxLight : THEME.boxDark;
  g.fillStyle(light, 0.6);
  g.fillRect(X + 2, Y + 2, W - 4, 1);
  g.fillRect(X + 2, Y + 2, 1, H - 4);
  g.fillStyle(dark, 0.6);
  g.fillRect(X + 2, Y + H - 3, W - 4, 1);
  g.fillRect(X + W - 3, Y + 2, 1, H - 4);
}

/** A tappable pixel button: window-box + label, with pressed-bevel feedback. */
export class PixelButton {
  readonly container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.BitmapText;
  private w: number;
  private h: number;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, onTap: () => void) {
    this.bg = scene.add.graphics();
    this.label = pixelText(scene, 0, 0, text, { size: 16, origin: 0.5 });
    this.w = this.label.width + 24;
    this.h = 34;
    this.label.setPosition(this.w / 2, this.h / 2 - 1);
    this.draw(false, false);

    this.container = scene.add.container(x, y, [this.bg, this.label]);
    this.container.setSize(this.w, this.h);
    this.container.setInteractive(new Phaser.Geom.Rectangle(0, 0, this.w, this.h), Phaser.Geom.Rectangle.Contains);
    this.container.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      this.draw(true, this.activeState);
      this.label.setPosition(this.w / 2, this.h / 2);
    });
    const release = () => {
      this.draw(false, this.activeState);
      this.label.setPosition(this.w / 2, this.h / 2 - 1);
    };
    this.container.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      release();
      onTap();
    });
    this.container.on('pointerout', release);
    this.container.on('pointerupoutside', release);
  }

  private activeState = false;

  setActive(active: boolean): this {
    this.activeState = active;
    this.label.setTint(active ? THEME.gold : THEME.ink);
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

  setY(y: number): this {
    this.container.setY(y);
    return this;
  }

  private draw(pressed: boolean, active: boolean): void {
    this.bg.clear();
    pixelBox(this.bg, 0, 0, this.w, this.h, {
      fill: pressed ? 0x24331a : THEME.boxFillDark,
      accent: active ? THEME.gold : THEME.boxDark,
      pressed,
    });
  }
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Safe-area insets (notch/home-bar) via a probe element; 0 on desktop. */
export function safeInsets(min = 10): Insets {
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
    /* probe unavailable */
  }
  return { top: raw.top + min, right: raw.right + min, bottom: raw.bottom + min, left: raw.left + min };
}
