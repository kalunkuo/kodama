import Phaser from 'phaser';

export class Park extends Phaser.Scene {
  constructor() {
    super('Park');
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor('#1a1f16');

    this.add
      .text(width / 2, height / 2, 'Ramble — M0', {
        fontFamily: 'sans-serif',
        fontSize: '32px',
        color: '#e8e6d8',
      })
      .setOrigin(0.5);
  }
}
