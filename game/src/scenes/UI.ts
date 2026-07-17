import Phaser from 'phaser';
import { SWARM_CAP } from '../config/constants';
import { audio } from '../systems/Audio';
import { CaptureGame, CaptureRequest } from '../systems/Capture';
import { Chip, PillButton, THEME, drawPanel, safeInsets, Insets } from '../ui/kit';
import type { Park } from './Park';

export class UI extends Phaser.Scene {
  private capture!: CaptureGame;
  private statChip!: Chip;
  private zoneChip!: Chip;
  private dexBtn!: PillButton;
  private parkBtn!: PillButton;
  private creditsBtn!: PillButton;
  private hint!: Phaser.GameObjects.Container;
  private toastBox!: Phaser.GameObjects.Container;
  private toastBg!: Phaser.GameObjects.Graphics;
  private toastText!: Phaser.GameObjects.Text;
  private toastQueue: string[] = [];
  private toastBusy = false;
  private creditsPanel: Phaser.GameObjects.Container | null = null;
  private insets!: Insets;

  constructor() {
    super('UI');
  }

  private park(): Park {
    return this.scene.get('Park') as Park;
  }

  create(): void {
    this.capture = new CaptureGame(this);
    this.insets = safeInsets();

    // top-left status cluster
    this.statChip = new Chip(this, 0, 0, '');
    this.zoneChip = new Chip(this, 0, 0, '').setVisible(false);

    // top-right controls
    this.dexBtn = new PillButton(this, 0, 0, '📖  Dex', () => {
      audio.unlock();
      if (this.scene.isActive('Dex')) this.scene.stop('Dex');
      else this.scene.launch('Dex');
    });
    this.parkBtn = new PillButton(this, 0, 0, '📍  Park mode', () => {
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
    this.creditsBtn = new PillButton(this, 0, 0, 'ⓘ  About', () => this.toggleCredits());

    this.buildToast();
    this.buildHint();
    this.layout();
    this.scale.on('resize', () => {
      this.insets = safeInsets();
      this.layout();
    });

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

    // fade the control hint out after the first few seconds
    this.time.delayedCall(7000, () => {
      this.tweens.add({ targets: this.hint, alpha: 0, duration: 800 });
    });
  }

  private layout(): void {
    const w = this.scale.width;
    const { top, left, right, bottom } = this.insets;

    this.statChip.setPosition(left, top);
    this.zoneChip.setPosition(left, top + 40);

    const btnX = (btn: PillButton) => w - right - btn.width;
    this.dexBtn.setX(btnX(this.dexBtn)).container.setY(top);
    this.parkBtn.setX(btnX(this.parkBtn)).container.setY(top + 48);
    this.creditsBtn.setX(btnX(this.creditsBtn)).container.setY(top + 96);

    this.toastBox.setPosition(w / 2, top + 92);
    this.hint.setPosition(w / 2, this.scale.height - bottom);
  }

  private buildToast(): void {
    this.toastBg = this.add.graphics();
    this.toastText = this.add
      .text(0, 0, '', { fontFamily: THEME.sans, fontSize: '15px', color: THEME.gold, align: 'center' })
      .setOrigin(0.5);
    this.toastBox = this.add.container(0, 0, [this.toastBg, this.toastText]).setDepth(30).setVisible(false);
  }

  private buildHint(): void {
    const bg = this.add.graphics();
    const label = this.add
      .text(0, 0, 'tap: move / catch   ·   tap 🌰: throw   ·   hold: whistle', {
        fontFamily: THEME.sans,
        fontSize: '12px',
        color: THEME.inkMuted,
      })
      .setOrigin(0.5);
    drawPanel(bg, label.width + 24, label.height + 12, {
      x: -(label.width + 24) / 2,
      y: -(label.height + 12),
      radius: (label.height + 12) / 2,
      alpha: 0.7,
      stroke: THEME.panelStrokeSoft,
    });
    this.hint = this.add.container(0, 0, [bg, label]).setDepth(20);
    label.setY(-(label.height + 12) / 2);
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
    this.toastText.setText(msg);
    const w = this.toastText.width + 28;
    const h = this.toastText.height + 16;
    this.toastBg.clear();
    drawPanel(this.toastBg, w, h, { x: -w / 2, y: -h / 2, radius: h / 2, alpha: 0.92, stroke: THEME.goldNum });
    this.toastBox.setVisible(true).setAlpha(0).setScale(0.9);
    this.tweens.add({ targets: this.toastBox, alpha: 1, scale: 1, duration: 180, ease: 'Back.easeOut' });
    this.time.delayedCall(1700, () => {
      this.tweens.add({
        targets: this.toastBox,
        alpha: 0,
        duration: 260,
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
    const scrim = this.add.rectangle(0, 0, width, height, THEME.scrimFill, 0.93).setOrigin(0).setInteractive();

    const title = this.add
      .text(width / 2, height / 2 - 150, 'RAMBLE', {
        fontFamily: THEME.serif,
        fontSize: '38px',
        color: THEME.gold,
      })
      .setOrigin(0.5);
    const body = this.add
      .text(
        width / 2,
        height / 2 - 96,
        [
          'A creature-herding game set in the Ramble,',
          'Central Park, New York.',
          '',
          'Map data © OpenStreetMap contributors (ODbL)',
          'openstreetmap.org/copyright',
          '',
          'Species occurrence & seasonality data',
          'from iNaturalist — inaturalist.org',
          '',
          'All art & sound generated procedurally (CC0).',
        ].join('\n'),
        {
          fontFamily: THEME.sans,
          fontSize: '14px',
          color: THEME.ink,
          align: 'center',
          lineSpacing: 5,
        }
      )
      .setOrigin(0.5, 0);
    const close = this.add
      .text(width / 2, height / 2 + 150, 'tap anywhere to close', {
        fontFamily: THEME.sans,
        fontSize: '12px',
        color: THEME.inkFaint,
      })
      .setOrigin(0.5);

    scrim.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      this.toggleCredits();
    });
    this.creditsPanel = this.add.container(0, 0, [scrim, title, body, close]).setDepth(50);
  }

  update(_time: number, delta: number): void {
    this.capture.update(delta);
    const park = this.park();
    if (!park.swarm) return;
    this.statChip.setText(`🐦 ${park.swarm.size}/${SWARM_CAP}    🌰 ${park.save.data.offerings}`);
    const loc = park.location;
    if (loc.enabled) {
      const label =
        loc.zone === 'ramble'
          ? '📍 in the Ramble  ×3'
          : loc.zone === 'central_park'
            ? '📍 in Central Park  ×2'
            : '📍 offsite';
      this.zoneChip.setText(label).setVisible(true);
    } else if (loc.error) {
      this.zoneChip.setText(`📍 ${loc.error}`).setVisible(true);
    } else {
      this.zoneChip.setVisible(false);
    }
  }
}
