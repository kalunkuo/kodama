import Phaser from 'phaser';
import { SWARM_CAP } from '../config/constants';
import { audio } from '../systems/Audio';
import { CaptureGame, CaptureRequest } from '../systems/Capture';
import { PixelButton, THEME, pixelBox, pixelText, setPixelText, safeInsets, Insets } from '../ui/kit';
import type { Park } from './Park';

export class UI extends Phaser.Scene {
  private capture!: CaptureGame;
  private statBox!: Phaser.GameObjects.Graphics;
  private statChildren!: Phaser.GameObjects.Container;
  private swarmText!: Phaser.GameObjects.BitmapText;
  private acornIcon!: Phaser.GameObjects.Image;
  private offerText!: Phaser.GameObjects.BitmapText;
  private zoneBox!: Phaser.GameObjects.Container;
  private zoneBg!: Phaser.GameObjects.Graphics;
  private zoneText!: Phaser.GameObjects.BitmapText;
  private dexBtn!: PixelButton;
  private parkBtn!: PixelButton;
  private infoBtn!: PixelButton;
  private hint!: Phaser.GameObjects.Container;
  private toastBox!: Phaser.GameObjects.Container;
  private toastBg!: Phaser.GameObjects.Graphics;
  private toastText!: Phaser.GameObjects.BitmapText;
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

    this.buildStat();
    this.buildZone();

    this.dexBtn = new PixelButton(this, 0, 0, 'DEX', () => {
      audio.unlock();
      if (this.scene.isActive('Dex')) this.scene.stop('Dex');
      else this.scene.launch('Dex');
    });
    this.parkBtn = new PixelButton(this, 0, 0, 'PARK', () => {
      audio.unlock();
      const loc = this.park().location;
      if (loc.enabled) {
        loc.disable();
        this.toast('Park mode off');
      } else {
        loc.enable();
        this.toast('Park mode: locating');
      }
    });
    this.infoBtn = new PixelButton(this, 0, 0, 'INFO', () => this.toggleCredits());

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

    this.time.delayedCall(7000, () => this.tweens.add({ targets: this.hint, alpha: 0, duration: 800 }));
  }

  private buildStat(): void {
    this.statBox = this.add.graphics();
    const birdIcon = this.add.image(0, 0, 'bird_small').setScale(2).setOrigin(0, 0.5);
    this.swarmText = pixelText(this, 0, 0, '0/40', { size: 16, origin: [0, 0.5] });
    this.acornIcon = this.add.image(0, 0, 'acorn').setScale(1.6).setOrigin(0, 0.5);
    this.offerText = pixelText(this, 0, 0, '0', { size: 16, tint: THEME.gold, origin: [0, 0.5] });
    this.statChildren = this.add.container(0, 0, [this.statBox, birdIcon, this.swarmText, this.acornIcon, this.offerText]);
    this.statChildren.setData('birdIcon', birdIcon);
    this.redrawStat();
  }

  private redrawStat(): void {
    const h = 30;
    const cy = h / 2;
    const pad = 9;
    const bird = this.statChildren.getData('birdIcon') as Phaser.GameObjects.Image;
    let x = pad;
    bird.setPosition(x, cy);
    x += 16 + 5;
    this.swarmText.setPosition(x, cy);
    x += this.swarmText.width + 12;
    this.acornIcon.setPosition(x, cy);
    x += 13 + 5;
    this.offerText.setPosition(x, cy);
    x += this.offerText.width + pad;
    this.statBox.clear();
    pixelBox(this.statBox, 0, 0, x, h);
    // keep the box behind the icons/text
    this.statChildren.sendToBack(this.statBox);
  }

  private buildZone(): void {
    this.zoneBg = this.add.graphics();
    this.zoneText = pixelText(this, 9, 8, '', { size: 16, origin: [0, 0] });
    this.zoneBox = this.add.container(0, 0, [this.zoneBg, this.zoneText]).setVisible(false);
  }

  private redrawZone(): void {
    const w = this.zoneText.width + 18;
    const h = this.zoneText.height + 14;
    this.zoneBg.clear();
    pixelBox(this.zoneBg, 0, 0, w, h);
    this.zoneText.setPosition(9, 7);
  }

  private layout(): void {
    const w = this.scale.width;
    const { top, left, right, bottom } = this.insets;
    this.statChildren.setPosition(left, top);
    this.zoneBox.setPosition(left, top + 38);

    this.dexBtn.setX(w - right - this.dexBtn.width).setY(top);
    this.parkBtn.setX(w - right - this.parkBtn.width).setY(top + 42);
    this.infoBtn.setX(w - right - this.infoBtn.width).setY(top + 84);

    this.toastBox.setPosition(w / 2, top + 84);
    this.hint.setPosition(w / 2, this.scale.height - bottom);
  }

  private buildToast(): void {
    this.toastBg = this.add.graphics();
    this.toastText = pixelText(this, 0, 0, '', { size: 16, tint: THEME.gold, origin: 0.5 });
    this.toastBox = this.add.container(0, 0, [this.toastBg, this.toastText]).setDepth(30).setVisible(false);
  }

  private buildHint(): void {
    const bg = this.add.graphics();
    const label = pixelText(this, 0, 0, 'TAP MOVE/CATCH  ·  TAP NUT THROW  ·  HOLD WHISTLE', {
      size: 8,
      tint: THEME.inkMuted,
      origin: 0.5,
    });
    const w = label.width + 20;
    const h = 20;
    pixelBox(bg, -w / 2, -h, w, h, { alpha: 0.8 });
    label.setPosition(0, -h / 2);
    this.hint = this.add.container(0, 0, [bg, label]).setDepth(20);
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
    setPixelText(this.toastText, msg);
    const w = this.toastText.width + 24;
    const h = this.toastText.height + 16;
    this.toastBg.clear();
    pixelBox(this.toastBg, -w / 2, -h / 2, w, h, { accent: THEME.gold });
    this.toastBox.setVisible(true).setAlpha(0).setScale(0.85);
    this.tweens.add({ targets: this.toastBox, alpha: 1, scale: 1, duration: 160, ease: 'Back.easeOut' });
    this.time.delayedCall(1700, () => {
      this.tweens.add({ targets: this.toastBox, alpha: 0, duration: 240, onComplete: () => this.nextToast() });
    });
  }

  private toggleCredits(): void {
    if (this.creditsPanel) {
      this.creditsPanel.destroy();
      this.creditsPanel = null;
      return;
    }
    const { width, height } = this.scale;
    const scrim = this.add.rectangle(0, 0, width, height, THEME.scrim, 0.94).setOrigin(0).setInteractive();
    const cx = width / 2;

    const panelW = Math.min(width - 40, 320);
    const panelH = 250;
    const box = this.add.graphics();
    pixelBox(box, cx - panelW / 2, height / 2 - panelH / 2, panelW, panelH, { alpha: 0.98 });

    const title = pixelText(this, cx, height / 2 - 96, 'RAMBLE', { size: 32, tint: THEME.gold, origin: 0.5 });
    const body = pixelText(
      this,
      cx,
      height / 2 - 54,
      [
        'A CREATURE-HERDING GAME',
        'IN CENTRAL PARK\'S RAMBLE',
        '',
        'MAP DATA (C) OPENSTREETMAP',
        'CONTRIBUTORS  -  ODBL',
        '',
        'SPECIES DATA FROM',
        'INATURALIST',
        '',
        'ART + SOUND: PROCEDURAL',
      ].join('\n'),
      { size: 8, tint: THEME.ink, origin: [0.5, 0] }
    );
    body.setCenterAlign();
    const close = pixelText(this, cx, height / 2 + 96, 'TAP TO CLOSE', { size: 8, tint: THEME.inkFaint, origin: 0.5 });

    scrim.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      this.toggleCredits();
    });
    this.creditsPanel = this.add.container(0, 0, [scrim, box, title, body, close]).setDepth(50);
  }

  update(_time: number, delta: number): void {
    this.capture.update(delta);
    const park = this.park();
    if (!park.swarm) return;
    setPixelText(this.swarmText, `${park.swarm.size}/${SWARM_CAP}`);
    setPixelText(this.offerText, `${park.save.data.offerings}`);
    this.redrawStat();

    const loc = park.location;
    if (loc.enabled) {
      const label =
        loc.zone === 'ramble'
          ? 'IN THE RAMBLE x3'
          : loc.zone === 'central_park'
            ? 'CENTRAL PARK x2'
            : 'OFFSITE';
      setPixelText(this.zoneText, label);
      this.redrawZone();
      this.zoneBox.setVisible(true);
    } else if (loc.error) {
      setPixelText(this.zoneText, 'GPS UNAVAILABLE');
      this.redrawZone();
      this.zoneBox.setVisible(true);
    } else {
      this.zoneBox.setVisible(false);
    }
  }
}
