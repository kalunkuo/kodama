import type { Coordinates } from '../player/GPSService';
import type { Spirit } from '../spirits/SpiritManager';
import type { SpiritRarity } from '../spirits/SpiritTypes';

export class SpiritRadar {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private readonly RADAR_RADIUS = 200;

  init(): void {
    this.canvas = document.getElementById('radar-canvas') as HTMLCanvasElement;
    if (!this.canvas) return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    this.ctx = ctx;
    this.drawBackground();
  }

  update(playerPos: Coordinates, spirits: Spirit[]): void {
    if (!this.ctx) return;
    this.drawBackground();

    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const canvasRadius = cx - 4;

    spirits.forEach(spirit => {
      const dlat = spirit.position.lat - playerPos.lat;
      const dlng = spirit.position.lng - playerPos.lng;
      const metersLat = dlat * 111320;
      const metersLng = dlng * 111320 * Math.cos(playerPos.lat * Math.PI / 180);
      const distance = Math.sqrt(metersLat * metersLat + metersLng * metersLng);
      const angle = Math.atan2(metersLng, metersLat);

      if (distance <= this.RADAR_RADIUS) {
        this.drawSpirit(spirit, angle, distance, canvasRadius);
      }
    });
  }

  private drawBackground(): void {
    const ctx = this.ctx;
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const r = cx - 4;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10, 15, 30, 0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    [0.33, 0.66].forEach(ratio => {
      ctx.beginPath();
      ctx.arc(cx, cy, r * ratio, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.15)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });

    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.2)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#60a5fa';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private drawSpirit(spirit: Spirit, angle: number, distance: number, canvasRadius: number): void {
    const ctx = this.ctx;
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    const normalizedDist = Math.min(distance / this.RADAR_RADIUS, 1);
    const x = cx + Math.sin(angle) * normalizedDist * canvasRadius;
    const y = cy - Math.cos(angle) * normalizedDist * canvasRadius;

    const color = this.getRarityColor(spirit.type.rarity);

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, 6);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  private getRarityColor(rarity: SpiritRarity): string {
    const colors: Record<SpiritRarity, string> = {
      common: '#4ade80',
      rare: '#60a5fa',
      epic: '#c084fc',
      legendary: '#fbbf24',
    };
    return colors[rarity];
  }
}
