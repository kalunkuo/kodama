import Phaser from 'phaser';
import { SWARM_CAP } from '../config/constants';
import { audio } from '../systems/Audio';
import { CaptureGame, CaptureRequest } from '../systems/Capture';
import type { Park } from './Park';

const FONT = 'sans-serif';

export class UI extends Phaser.Scene {
  private capture!: CaptureGame;
  private swarmChip!: Phaser.GameObjects.Text;
  private offeringsChip!: Phaser.GameObjects.Text;
  private zoneChip!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private toastQueue: string[] = [];
  private toastBusy = false;
  private creditsPanel: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('UI');
  }

  private park(): Park {
    return this.scene.get('Park') as Park;
  }

  create(): void {
    this.capture = new CaptureGame(this);

    this.swarmChip = this.chip(12, 12, '');
    this.offeringsChip = this.chip(12, 44, '');
    this.zoneChip = this.chip(12, 76, '').setVisible(false);

    const dexBtn = this.button(0, 12, '📖 Dex', () => {
      audio.unlock();
      if (this.scene.isActive('Dex')) this.scene.stop('Dex');
      else this.scene.launch('Dex');
    });
    const parkBtn = this.button(0, 52, '📍 Park mode', () => {
      audio.unlock();
      const loc = this.park().location;
      if (loc.enabled) {
        loc.disable();
        this.toast('Park mode off');
      } else {
        loc.enable();
        this.toast('Park mode: locating…');
      }
    });
    const creditsBtn = this.button(0, 92, 'ⓘ', () => this.toggleCredits());
    const layout = () => {
      const w = this.scale.width;
      dexBtn.setX(w - dexBtn.width - 12);
      parkBtn.setX(w - parkBtn.width - 12);
      creditsBtn.setX(w - creditsBtn.width - 12);
      this.toastText.setX(w / 2);
      hint.setPosition(w / 2, this.scale.height - 16);
    };

    this.toastText = this.add
      .text(this.scale.width / 2, 118, '', {
        fontFamily: FONT,
        fontSize: '14px',
        color: '#ffe9a8',
        backgroundColor: '#00000099',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5, 0)
      .setDepth(10)
      .setVisible(false);

    const hint = this.add
      .text(
        this.scale.width / 2,
        this.scale.height - 16,
        'tap: move / catch · tap acorn: throw · hold: whistle',
        {
          fontFamily: FONT,
          fontSize: '12px',
          color: '#9aa08a',
          backgroundColor: '#00000066',
          padding: { x: 8, y: 4 },
        }
      )
      .setOrigin(0.5, 1);

    layout();
    this.scale.on('resize', layout);

    this.game.events.on('capture:start', (req: CaptureRequest) => {
      this.capture.start({
        ...req,
        onResult: (success) => {
          req.onResult(success);
          this.game.events.emit('capture:done');
        },
      });
    });
    this.game.events.on('toast', (msg: string) => this.toast(msg));
  }

  private chip(x: number, y: number, text: string): Phaser.GameObjects.Text {
    return this.add.text(x, y, text, {
      fontFamily: FONT,
      fontSize: '14px',
      color: '#e8e6d8',
      backgroundColor: '#00000099',
      padding: { x: 10, y: 5 },
    });
  }

  private button(x: number, y: number, label: string, onTap: () => void): Phaser.GameObjects.Text {
    const btn = this.add
      .text(x, y, label, {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#e8e6d8',
        backgroundColor: '#2c3626ee',
        padding: { x: 12, y: 7 },
      })
      .setInteractive({ useHandCursor: true });
    btn.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      onTap();
    });
    return btn;
  }

  private toast(msg: string): void {
    this.toastQueue.push(msg);
    if (!this.toastBusy) this.nextToast();
  }

  private nextToast(): void {
    const msg = this.toastQueue.shift();
    if (!msg) {
      this.toastBusy = false;
      return;
    }
    this.toastBusy = true;
    this.toastText.setText(msg).setVisible(true).setAlpha(1);
    this.time.delayedCall(1600, () => {
      this.tweens.add({
        targets: this.toastText,
        alpha: 0,
        duration: 300,
        onComplete: () => this.nextToast(),
      });
    });
  }

  private toggleCredits(): void {
    if (this.creditsPanel) {
      this.creditsPanel.destroy();
      this.creditsPanel = null;
      return;
    }
    const { width, height } = this.scale;
    const bg = this.add
      .rectangle(0, 0, width, height, 0x101408, 0.92)
      .setOrigin(0)
      .setInteractive();
    const text = this.add
      .text(
        width / 2,
        height / 2,
        [
          'RAMBLE',
          '',
          'A creature-herding game set in the Ramble,',
          'Central Park, New York.',
          '',
          'Map data © OpenStreetMap contributors (ODbL)',
          'openstreetmap.org/copyright',
          '',
          'Species occurrence & seasonality data from',
          'iNaturalist — inaturalist.org',
          '',
          'All art & sound generated procedurally (CC0).',
          '',
          'tap anywhere to close',
        ].join('\n'),
        {
          fontFamily: FONT,
          fontSize: '14px',
          color: '#e8e6d8',
          align: 'center',
          lineSpacing: 3,
        }
      )
      .setOrigin(0.5);
    bg.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      this.toggleCredits();
    });
    this.creditsPanel = this.add.container(0, 0, [bg, text]).setDepth(50);
  }

  update(_time: number, delta: number): void {
    this.capture.update(delta);
    const park = this.park();
    if (!park.swarm) return;
    this.swarmChip.setText(`🐦 ${park.swarm.size}/${SWARM_CAP}`);
    this.offeringsChip.setText(`🌰 ${park.save.data.offerings}`);
    const loc = park.location;
    if (loc.enabled) {
      const label =
        loc.zone === 'ramble'
          ? '📍 in the Ramble ×3'
          : loc.zone === 'central_park'
            ? '📍 in Central Park ×2'
            : '📍 offsite';
      this.zoneChip.setText(label).setVisible(true);
    } else if (loc.error) {
      this.zoneChip.setText(`📍 ${loc.error}`).setVisible(true);
    } else {
      this.zoneChip.setVisible(false);
    }
  }
}
