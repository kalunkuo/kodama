import type { SpiritManager, Spirit } from './SpiritManager';
import type { EventBus } from '../core/EventBus';
import type { Coordinates } from '../player/GPSService';
import { getRandomSpiritType } from './SpiritTypes';

let spiritIdCounter = 0;

export class SpiritSpawner {
  private readonly MAX_SPIRITS = 5;
  private readonly SPAWN_RADIUS_MIN = 50;
  private readonly SPAWN_RADIUS_MAX = 100;
  private spawnTimer = 0;
  private readonly SPAWN_INTERVAL = 15;

  constructor(private spiritManager: SpiritManager, private _eventBus: EventBus) {}

  update(delta: number, playerPosition: Coordinates): void {
    this.spawnTimer += delta;
    if (this.spawnTimer >= this.SPAWN_INTERVAL) {
      this.spawnTimer = 0;
      this.trySpawn(playerPosition);
    }
    this.spiritManager.cleanup();
  }

  spawnInitial(playerPosition: Coordinates): void {
    const count = Math.min(3, this.MAX_SPIRITS - this.spiritManager.getActiveSpirits().length);
    for (let i = 0; i < count; i++) {
      this.trySpawn(playerPosition);
    }
  }

  private trySpawn(playerPosition: Coordinates): void {
    const active = this.spiritManager.getActiveSpirits();
    if (active.length >= this.MAX_SPIRITS) return;

    const angle = Math.random() * Math.PI * 2;
    const distance = this.SPAWN_RADIUS_MIN + Math.random() * (this.SPAWN_RADIUS_MAX - this.SPAWN_RADIUS_MIN);
    const metersLat = Math.cos(angle) * distance;
    const metersLng = Math.sin(angle) * distance;
    const position = this.offsetCoordinates(playerPosition, metersLat, metersLng);
    const type = getRandomSpiritType();

    const spirit: Spirit = {
      id: `spirit_${Date.now()}_${spiritIdCounter++}`,
      type,
      position,
      spawnTime: Date.now(),
      collected: false,
    };

    this.spiritManager.addSpirit(spirit);
  }

  private offsetCoordinates(base: Coordinates, metersLat: number, metersLng: number): Coordinates {
    const EARTH_RADIUS = 6371000;
    const dlat = (metersLat / EARTH_RADIUS) * (180 / Math.PI);
    const dlng = (metersLng / (EARTH_RADIUS * Math.cos(base.lat * Math.PI / 180))) * (180 / Math.PI);
    return {
      lat: base.lat + dlat,
      lng: base.lng + dlng,
    };
  }
}
