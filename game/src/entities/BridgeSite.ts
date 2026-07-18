import Phaser from 'phaser';
import { THEME, pixelBox, pixelText, setPixelText } from '../ui/kit';
import { Bridge } from '../systems/Bridges';
import { Creature } from './Creature';

const BUILD_MS = 2600; // channel time once enough creatures are attached

/**
 * Stationary carry-verb site (idea 2): thrown creatures attach here like a
 * CarryObject, but instead of traveling, once `required` are attached the
 * site channels for BUILD_MS and then the bridge is complete.
 */
export class BridgeSite {
  readonly bridge: Bridge;
  readonly sprite: Phaser.GameObjects.Image;
  readonly attached: Creature[] = [];
  built = false;
  private label: Phaser.GameObjects.BitmapText;
  private bar: Phaser.GameObjects.Graphics;
  private buildElapsed = 0;
  private building = false;

  constructor(scene: Phaser.Scene, bridge: Bridge) {
    this.bridge = bridge;
    this.sprite = scene.add.image(bridge.anchor.x, bridge.anchor.y, 'bridge_post');
    this.sprite.setDepth(bridge.anchor.y);
    this.label = pixelText(scene, bridge.anchor.x, bridge.anchor.y - 20, `0/${bridge.required}`, {
      size: 8,
      tint: THEME.gold,
      origin: 0.5,
    }).setDepth(1_000_000);
    this.bar = scene.add.graphics().setDepth(1_000_000);
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  attach(creature: Creature): void {
    if (this.built || this.building || this.attached.length >= this.bridge.required) return;
    creature.state = 'working';
    this.attached.push(creature);
    setPixelText(this.label, `${this.attached.length}/${this.bridge.required}`);
    if (this.attached.length >= this.bridge.required) {
      this.building = true;
      this.buildElapsed = 0;
    }
  }

  /** Whistle-recallable like a carry object — pulling a creature mid-build cancels the channel. */
  detach(creature: Creature): void {
    const i = this.attached.indexOf(creature);
    if (i < 0) return;
    this.attached.splice(i, 1);
    if (this.attached.length < this.bridge.required) {
      this.building = false;
      this.buildElapsed = 0;
      this.bar.clear();
    }
    setPixelText(this.label, `${this.attached.length}/${this.bridge.required}`);
    this.label.setPosition(this.bridge.anchor.x, this.bridge.anchor.y - 20);
  }

  /** Returns true the frame construction completes. */
  update(dtMs: number): boolean {
    for (let i = 0; i < this.attached.length; i++) {
      const angle = (i / Math.max(1, this.attached.length)) * Math.PI * 2;
      const c = this.attached[i];
      const r = this.building ? 14 : 10;
      c.sprite.setPosition(this.x + Math.cos(angle) * r, this.y + Math.sin(angle) * r * 0.7);
      c.sprite.setDepth(c.sprite.y);
    }

    if (!this.building) return false;
    this.buildElapsed += dtMs;
    const t = Math.min(1, this.buildElapsed / BUILD_MS);
    this.bar.clear();
    pixelBox(this.bar, this.x - 17, this.y - 34, 34, 10, { fill: THEME.boxFillDark });
    this.bar.fillStyle(THEME.gold, 1).fillRect(this.x - 14, this.y - 31, Math.round(28 * t), 4);
    setPixelText(this.label, t < 1 ? 'BUILDING...' : 'DONE!');
    this.label.setPosition(this.x, this.y - 42);
    if (t >= 1) {
      this.built = true;
      return true;
    }
    return false;
  }

  destroy(): void {
    this.sprite.destroy();
    this.label.destroy();
    this.bar.destroy();
  }
}
