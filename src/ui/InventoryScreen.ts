import type { EventBus } from '../core/EventBus';
import type { Spirit } from '../spirits/SpiritManager';
import type { SpiritRarity, SpiritElement } from '../spirits/SpiritTypes';

export class InventoryScreen {
  private container!: HTMLElement;
  private visible = false;

  constructor(private _eventBus: EventBus) {}

  init(): void {
    this.container = document.getElementById('inventory-screen')!;
    const closeBtn = document.getElementById('inventory-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }
  }

  show(): void {
    this.container.classList.remove('hidden');
    this.visible = true;
  }

  hide(): void {
    this.container.classList.add('hidden');
    this.visible = false;
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  refresh(spirits: Spirit[]): void {
    const grid = document.getElementById('inventory-grid');
    if (!grid) return;
    if (spirits.length === 0) {
      grid.innerHTML = `
        <div class="inventory-empty">
          <div style="font-size:48px">🌲</div>
          <p>No spirits collected yet.<br>Go explore to find them!</p>
        </div>
      `;
      return;
    }
    grid.innerHTML = spirits.map(s => this.buildSpiritCard(s)).join('');
  }

  private buildSpiritCard(spirit: Spirit): string {
    const rarityColor = this.getRarityColor(spirit.type.rarity);
    const elementIcon = this.getElementIcon(spirit.type.element);
    return `
      <div class="spirit-card" style="border-color:${rarityColor};box-shadow:0 0 10px ${rarityColor}33">
        <div class="spirit-card-icon" style="color:${rarityColor}">${elementIcon}</div>
        <div class="spirit-card-name">${spirit.type.name}</div>
        <div class="spirit-card-rarity" style="color:${rarityColor}">${spirit.type.rarity}</div>
        <div class="spirit-card-energy">+${spirit.type.energyValue}⚡</div>
      </div>
    `;
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

  private getElementIcon(element: SpiritElement): string {
    const icons: Record<SpiritElement, string> = {
      forest: '🌿',
      water: '💧',
      mountain: '⛰️',
      wind: '🌬️',
      earth: '🌱',
    };
    return icons[element];
  }
}
