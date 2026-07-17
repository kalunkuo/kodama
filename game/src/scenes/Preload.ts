import Phaser from 'phaser';
// The contract (plan §4): the game reads only data/*.json, produced by the pipeline.
import mapUrl from '../../../data/ramble_map.json?url';
import speciesUrl from '../../../data/species.json?url';
import { buildPixelFont } from '../ui/kit';

type Px = [x: number, y: number, w: number, h: number, color: number];

// Procedural 1-bit-era pixel sprites, drawn in whites/grays so per-species
// tint (multiply) supplies the color. Swap for a real CC0 pack later (plan §9).
const SPRITES: Record<string, { w: number; h: number; px: Px[] }> = {
  bird_small: {
    w: 8,
    h: 8,
    px: [
      [2, 2, 4, 4, 0xffffff], // body
      [5, 1, 2, 2, 0xffffff], // head
      [7, 2, 1, 1, 0xb0b0b0], // beak
      [6, 1, 1, 1, 0x222222], // eye
      [2, 3, 3, 2, 0xc4c4c4], // wing
      [1, 6, 1, 2, 0x8c8c8c], // legs
      [3, 6, 1, 2, 0x8c8c8c],
    ],
  },
  bird_medium: {
    w: 12,
    h: 10,
    px: [
      [2, 3, 7, 5, 0xffffff],
      [8, 1, 3, 3, 0xffffff],
      [11, 2, 1, 1, 0xb0b0b0],
      [9, 2, 1, 1, 0x222222],
      [3, 4, 4, 3, 0xc4c4c4],
      [4, 8, 1, 2, 0x8c8c8c],
      [6, 8, 1, 2, 0x8c8c8c],
    ],
  },
  bird_large: {
    w: 16,
    h: 13,
    px: [
      [2, 4, 10, 6, 0xffffff],
      [11, 1, 4, 4, 0xffffff],
      [15, 2, 1, 2, 0xb0b0b0],
      [13, 2, 1, 1, 0x222222],
      [3, 5, 6, 4, 0xc4c4c4],
      [0, 5, 2, 3, 0xdddddd], // tail
      [5, 10, 1, 3, 0x8c8c8c],
      [8, 10, 1, 3, 0x8c8c8c],
    ],
  },
  rodent_small: {
    w: 10,
    h: 8,
    px: [
      [2, 3, 5, 4, 0xffffff], // body
      [6, 2, 3, 3, 0xffffff], // head
      [7, 1, 1, 1, 0xdddddd], // ear
      [8, 3, 1, 1, 0x222222], // eye
      [0, 1, 2, 4, 0xc4c4c4], // tail curl
      [1, 0, 2, 2, 0xc4c4c4],
      [3, 7, 1, 1, 0x8c8c8c],
      [5, 7, 1, 1, 0x8c8c8c],
    ],
  },
  rodent_medium: {
    w: 13,
    h: 10,
    px: [
      [2, 4, 7, 5, 0xffffff],
      [8, 3, 4, 4, 0xffffff],
      [9, 2, 1, 1, 0xdddddd],
      [11, 2, 1, 1, 0xdddddd],
      [9, 4, 2, 2, 0x333333], // mask
      [10, 4, 1, 1, 0xeeeeee], // eye glint
      [0, 3, 2, 3, 0xc4c4c4], // ringed tail
      [0, 6, 2, 1, 0x777777],
      [3, 9, 2, 1, 0x8c8c8c],
      [6, 9, 2, 1, 0x8c8c8c],
    ],
  },
  turtle_small: {
    w: 10,
    h: 7,
    px: [
      [2, 1, 6, 4, 0xffffff], // shell
      [3, 2, 4, 2, 0xc4c4c4], // shell pattern
      [8, 3, 2, 2, 0xdddddd], // head
      [9, 3, 1, 1, 0x222222],
      [2, 5, 2, 2, 0xb0b0b0],
      [6, 5, 2, 2, 0xb0b0b0],
    ],
  },
  player: {
    w: 10,
    h: 15,
    px: [
      [3, 0, 4, 2, 0x5a4632], // hat/hair
      [3, 2, 4, 3, 0xe8c39e], // face
      [4, 3, 1, 1, 0x222222],
      [2, 5, 6, 5, 0x3e6e5a], // jacket
      [1, 5, 1, 4, 0xe8c39e], // arms
      [8, 5, 1, 4, 0xe8c39e],
      [3, 10, 2, 4, 0x4a4438], // legs
      [6, 10, 2, 4, 0x4a4438],
      [2, 14, 3, 1, 0x2c2822],
      [6, 14, 3, 1, 0x2c2822],
    ],
  },
  acorn: {
    w: 8,
    h: 10,
    px: [
      [1, 2, 6, 2, 0x6e5232], // cap
      [3, 0, 2, 2, 0x6e5232], // stem
      [2, 4, 4, 5, 0xb98a4e], // nut
      [3, 4, 1, 3, 0xd6ac72], // highlight
    ],
  },
  flag: {
    w: 14,
    h: 18,
    px: [
      [6, 0, 2, 18, 0x8a7a5c], // pole
      [8, 1, 6, 5, 0xd14f4f], // banner
      [0, 16, 14, 2, 0x6e6452], // ground
    ],
  },
};

export class Preload extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    this.load.json('map', mapUrl);
    this.load.json('species', speciesUrl);
  }

  create(): void {
    for (const [key, def] of Object.entries(SPRITES)) {
      const g = this.add.graphics();
      for (const [x, y, w, h, color] of def.px) {
        g.fillStyle(color, 1);
        g.fillRect(x, y, w, h);
      }
      g.generateTexture(key, def.w, def.h);
      g.destroy();
      this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    buildPixelFont(this);

    // small round soft dot for whistle/marker effects
    const dot = this.add.graphics();
    dot.fillStyle(0xffffff, 1);
    dot.fillCircle(4, 4, 4);
    dot.generateTexture('dot', 8, 8);
    dot.destroy();

    this.registry.set('species', this.cache.json.get('species'));
    this.scene.start('Park');
    this.scene.launch('UI');
  }
}
