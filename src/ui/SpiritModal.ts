import * as THREE from 'three';
import type { EventBus } from '../core/EventBus';
import type { Spirit } from '../spirits/SpiritManager';
import type { SpiritRarity, SpiritElement } from '../spirits/SpiritTypes';

export class SpiritModal {
  private modal!: HTMLElement;
  private visible = false;
  private previewRenderer: THREE.WebGLRenderer | null = null;
  private previewScene: THREE.Scene | null = null;
  private previewCamera: THREE.PerspectiveCamera | null = null;
  private previewMesh: THREE.Mesh | null = null;
  private previewFrame: number | null = null;
  private currentSpirit: Spirit | null = null;

  constructor(private eventBus: EventBus) {}

  init(): void {
    this.modal = document.getElementById('spirit-modal')!;
    const backdrop = this.modal.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => this.hide());
    }
  }

  show(spirit: Spirit): void {
    this.currentSpirit = spirit;
    const inner = document.getElementById('modal-inner')!;
    inner.innerHTML = this.buildModalContent(spirit);
    this.modal.classList.remove('hidden');
    this.visible = true;

    setTimeout(() => this.initPreview(spirit), 50);

    const collectBtn = document.getElementById('collect-btn');
    if (collectBtn) {
      collectBtn.addEventListener('click', () => {
        this.eventBus.emit('spirit:collect', spirit.id);
        this.hide();
      });
    }

    const closeBtn = document.getElementById('modal-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }
  }

  private initPreview(spirit: Spirit): void {
    const canvas = document.getElementById('spirit-preview-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    this.disposePreview();

    this.previewScene = new THREE.Scene();
    this.previewCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    this.previewCamera.position.set(0, 0, 3);

    this.previewRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.previewRenderer.setSize(200, 200);
    this.previewRenderer.setClearColor(0x000000, 0);

    const geo = new THREE.IcosahedronGeometry(1, 1);
    const mat = new THREE.MeshPhongMaterial({
      color: spirit.type.color,
      emissive: spirit.type.color,
      emissiveIntensity: 0.4,
      shininess: 100,
    });
    this.previewMesh = new THREE.Mesh(geo, mat);
    this.previewScene.add(this.previewMesh);

    const wireGeo = new THREE.IcosahedronGeometry(1.1, 0);
    const wireMat = new THREE.MeshBasicMaterial({
      color: spirit.type.color,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
    const wire = new THREE.Mesh(wireGeo, wireMat);
    this.previewScene.add(wire);

    const ambient = new THREE.AmbientLight(0xffffff, 0.3);
    this.previewScene.add(ambient);
    const pointLight = new THREE.PointLight(spirit.type.color, 2, 10);
    pointLight.position.set(2, 2, 2);
    this.previewScene.add(pointLight);
    const fillLight = new THREE.PointLight(0xffffff, 0.5, 10);
    fillLight.position.set(-2, -1, 1);
    this.previewScene.add(fillLight);

    const animate = () => {
      if (!this.visible) return;
      this.previewFrame = requestAnimationFrame(animate);
      if (this.previewMesh) {
        this.previewMesh.rotation.y += 0.02;
        this.previewMesh.rotation.x += 0.005;
        wire.rotation.y -= 0.01;
      }
      this.previewRenderer?.render(this.previewScene!, this.previewCamera!);
    };
    animate();
  }

  private disposePreview(): void {
    if (this.previewFrame !== null) {
      cancelAnimationFrame(this.previewFrame);
      this.previewFrame = null;
    }
    if (this.previewRenderer) {
      this.previewRenderer.dispose();
      this.previewRenderer = null;
    }
    this.previewScene = null;
    this.previewCamera = null;
    this.previewMesh = null;
  }

  hide(): void {
    this.modal.classList.add('hidden');
    this.visible = false;
    this.currentSpirit = null;
    this.disposePreview();
  }

  private buildModalContent(spirit: Spirit): string {
    const rarityColor = this.getRarityColor(spirit.type.rarity);
    const elementIcon = this.getElementIcon(spirit.type.element);
    return `
      <div class="modal-header" style="border-color:${rarityColor}">
        <button id="modal-close-btn" class="modal-close">✕</button>
        <div class="modal-rarity" style="color:${rarityColor}">${spirit.type.rarity.toUpperCase()}</div>
        <h2 class="modal-title" style="color:${rarityColor}">${elementIcon} ${spirit.type.name}</h2>
      </div>
      <div class="modal-preview">
        <canvas id="spirit-preview-canvas" width="200" height="200"></canvas>
        <div class="spirit-glow-bg" style="background:radial-gradient(circle, ${spirit.type.glowColor}33 0%, transparent 70%)"></div>
      </div>
      <div class="modal-info">
        <div class="modal-element">
          <span class="info-label">Element</span>
          <span class="info-value">${elementIcon} ${spirit.type.element}</span>
        </div>
        <div class="modal-energy">
          <span class="info-label">Energy</span>
          <span class="info-value" style="color:#fbbf24">+${spirit.type.energyValue} ⚡</span>
        </div>
        <p class="modal-description">${spirit.type.description}</p>
      </div>
      <button id="collect-btn" class="collect-btn" style="background:${rarityColor};box-shadow:0 0 20px ${rarityColor}66">
        Collect Spirit ✨
      </button>
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
