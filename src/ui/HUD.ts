export class HUD {
  private energyEl!: HTMLElement;
  private energyFill!: HTMLElement;
  private levelEl!: HTMLElement;
  private distanceEl!: HTMLElement;
  private spiritCountEl!: HTMLElement;

  init(): void {
    this.energyEl = document.getElementById('energy-text')!;
    this.energyFill = document.getElementById('energy-fill')!;
    this.levelEl = document.getElementById('level-display')!;
    this.distanceEl = document.getElementById('distance-display')!;
    this.spiritCountEl = document.getElementById('spirit-count')!;
  }

  updateEnergy(energy: number, maxEnergy: number): void {
    if (this.energyEl) this.energyEl.textContent = `${Math.floor(energy)}/${maxEnergy}`;
    if (this.energyFill) {
      const pct = Math.min(100, (energy / maxEnergy) * 100);
      this.energyFill.style.width = `${pct}%`;
    }
  }

  updateLevel(level: number): void {
    if (this.levelEl) this.levelEl.textContent = `Lv.${level}`;
  }

  updateDistance(meters: number): void {
    if (this.distanceEl) {
      if (meters >= 1000) {
        this.distanceEl.textContent = `${(meters / 1000).toFixed(2)}km explored`;
      } else {
        this.distanceEl.textContent = `${Math.floor(meters)}m explored`;
      }
    }
  }

  updateSpiritCount(count: number): void {
    if (this.spiritCountEl) this.spiritCountEl.textContent = String(count);
  }

  showNotification(message: string, type: 'info' | 'success' | 'warning' = 'info'): void {
    const container = document.getElementById('notifications');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `notification notification-${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('fade-out');
      setTimeout(() => el.remove(), 500);
    }, 3000);
  }
}
