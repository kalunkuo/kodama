import Phaser from 'phaser';
import { Boot } from './scenes/Boot';
import { Preload } from './scenes/Preload';
import { Park } from './scenes/Park';
import { UI } from './scenes/UI';
import { Dex } from './scenes/Dex';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#1a1f16',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: '100%',
    height: '100%',
  },
  scene: [Boot, Preload, Park, UI, Dex],
});

// handy for on-device debugging (eruda / devtools)
(window as unknown as { game: Phaser.Game }).game = game;
