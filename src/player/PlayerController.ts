import type { EventBus } from '../core/EventBus';
import type { GPSService, Coordinates } from './GPSService';

export type { Coordinates };

export class PlayerController {
  private position: Coordinates | null = null;
  private level = 1;
  private xp = 0;
  private readonly XP_PER_LEVEL = 100;

  constructor(private gpsService: GPSService, private eventBus: EventBus) {}

  init(): void {
    const saved = localStorage.getItem('kodama-player');
    if (saved) {
      const data = JSON.parse(saved);
      this.level = data.level ?? 1;
      this.xp = data.xp ?? 0;
    }

    this.gpsService.onPositionUpdate((coords: Coordinates) => {
      this.position = coords;
      this.eventBus.emit('player:position', coords);
      this.saveData();
    });

    this.gpsService.startTracking();
    this.eventBus.emit('player:levelup', { level: this.level });
  }

  getPosition(): Coordinates | null {
    return this.position;
  }

  getLevel(): number {
    return this.level;
  }

  getXP(): number {
    return this.xp;
  }

  getXPForLevel(): number {
    return this.XP_PER_LEVEL * this.level;
  }

  addXP(amount: number): void {
    this.xp += amount;
    this.checkLevelUp();
    this.saveData();
    this.eventBus.emit('player:xp', { xp: this.xp, level: this.level });
  }

  private checkLevelUp(): void {
    let required = this.XP_PER_LEVEL * this.level;
    while (this.xp >= required) {
      this.xp -= required;
      this.level++;
      this.eventBus.emit('player:levelup', { level: this.level });
      required = this.XP_PER_LEVEL * this.level;
    }
  }

  private saveData(): void {
    localStorage.setItem('kodama-player', JSON.stringify({
      level: this.level,
      xp: this.xp,
    }));
  }
}
