import type { EventBus } from '../core/EventBus';
import type { Coordinates } from '../player/GPSService';

export class ExplorationSystem {
  private totalDistance = 0;
  private lastPosition: Coordinates | null = null;
  private badges: string[] = [];

  constructor(private eventBus: EventBus) {
    const saved = localStorage.getItem('kodama-exploration');
    if (saved) {
      const data = JSON.parse(saved);
      this.totalDistance = data.totalDistance ?? 0;
      this.badges = data.badges ?? [];
    }
  }

  updatePosition(coords: Coordinates): void {
    if (this.lastPosition) {
      const dist = this.calculateDistance(this.lastPosition, coords);
      if (dist > 0.5 && dist < 500) {
        this.totalDistance += dist;
        this.eventBus.emit('exploration:distance', { totalDistance: this.totalDistance, delta: dist });
        this.checkBadges();
        this.save();
      }
    }
    this.lastPosition = coords;
  }

  private calculateDistance(a: Coordinates, b: Coordinates): number {
    const R = 6371000;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lng - a.lng) * Math.PI / 180;
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    return R * c;
  }

  getTotalDistance(): number {
    return this.totalDistance;
  }

  getBadges(): string[] {
    return [...this.badges];
  }

  private checkBadges(): void {
    const milestones = [
      { dist: 100, badge: '🥾 First Steps', id: 'first_steps' },
      { dist: 500, badge: '🏃 On the Move', id: 'on_the_move' },
      { dist: 1000, badge: '🗺️ Explorer', id: 'explorer' },
      { dist: 5000, badge: '🏔️ Wanderer', id: 'wanderer' },
      { dist: 10000, badge: '⭐ Pathfinder', id: 'pathfinder' },
    ];
    milestones.forEach(({ dist, badge, id }) => {
      if (this.totalDistance >= dist && !this.badges.includes(id)) {
        this.badges.push(id);
        this.eventBus.emit('exploration:badge', { badge, id });
      }
    });
  }

  private save(): void {
    localStorage.setItem('kodama-exploration', JSON.stringify({
      totalDistance: this.totalDistance,
      badges: this.badges,
    }));
  }
}
