import Phaser from 'phaser';

export class Preload extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  create(): void {
    this.scene.start('Park');
    this.scene.launch('UI');
  }
}
