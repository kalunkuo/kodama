import type { EventBus } from '../core/EventBus';

export class EnergySystem {
  private energy = 50;
  private maxEnergy = 200;
  private readonly REGEN_RATE = 1;
  private timer = 0;

  constructor(private eventBus: EventBus) {
    const saved = localStorage.getItem('kodama-energy');
    if (saved) {
      const data = JSON.parse(saved);
      this.energy = Math.min(data.energy ?? 50, this.maxEnergy);
    }
  }

  update(delta: number): void {
    this.timer += delta;
    if (this.timer >= 1) {
      this.timer -= 1;
      if (this.energy < this.maxEnergy) {
        this.energy = Math.min(this.energy + this.REGEN_RATE, this.maxEnergy);
        this.eventBus.emit('energy:changed', { energy: this.energy, maxEnergy: this.maxEnergy });
        localStorage.setItem('kodama-energy', JSON.stringify({ energy: this.energy }));
      }
    }
  }

  addEnergy(amount: number): void {
    this.energy = Math.min(this.energy + amount, this.maxEnergy);
    this.eventBus.emit('energy:changed', { energy: this.energy, maxEnergy: this.maxEnergy });
    localStorage.setItem('kodama-energy', JSON.stringify({ energy: this.energy }));
  }

  consumeEnergy(amount: number): boolean {
    if (this.energy < amount) return false;
    this.energy -= amount;
    this.eventBus.emit('energy:changed', { energy: this.energy, maxEnergy: this.maxEnergy });
    localStorage.setItem('kodama-energy', JSON.stringify({ energy: this.energy }));
    return true;
  }

  getEnergy(): number {
    return this.energy;
  }

  getMaxEnergy(): number {
    return this.maxEnergy;
  }
}
