import * as THREE from 'three';
import type { EventBus } from '../core/EventBus';
import type { Coordinates } from '../player/GPSService';
import type { SpiritType } from './SpiritTypes';

export interface Spirit {
  id: string;
  type: SpiritType;
  position: Coordinates;
  spawnTime: number;
  collected: boolean;
  mesh?: THREE.Group;
}

export class SpiritManager {
  private spirits: Map<string, Spirit> = new Map();
  private scene: THREE.Scene | null = null;
  private collected: Spirit[] = [];
  private time = 0;

  constructor(private eventBus: EventBus) {
    const saved = localStorage.getItem('kodama-spirits');
    if (saved) {
      this.collected = JSON.parse(saved);
    }
  }

  init(scene: THREE.Scene): void {
    this.scene = scene;
  }

  addSpirit(spirit: Spirit): void {
    if (this.scene) {
      spirit.mesh = this.createSpiritMesh(spirit);
      this.scene.add(spirit.mesh);
    }
    this.spirits.set(spirit.id, spirit);
    this.eventBus.emit('spirit:spawned', spirit);
  }

  private createSpiritMesh(spirit: Spirit): THREE.Group {
    const group = new THREE.Group();

    const coreGeo = new THREE.SphereGeometry(0.15, 16, 16);
    const coreMat = new THREE.MeshPhongMaterial({
      color: spirit.type.color,
      emissive: spirit.type.color,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.9,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    const icoGeo = new THREE.IcosahedronGeometry(0.25, 0);
    const icoMat = new THREE.MeshPhongMaterial({
      color: spirit.type.color,
      emissive: spirit.type.color,
      emissiveIntensity: 0.3,
      wireframe: true,
      transparent: true,
      opacity: 0.4,
    });
    const ico = new THREE.Mesh(icoGeo, icoMat);
    group.add(ico);

    const ringGeo = new THREE.TorusGeometry(0.3, 0.02, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: spirit.type.color,
      transparent: true,
      opacity: 0.6,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    const light = new THREE.PointLight(spirit.type.color, 1, 3);
    group.add(light);

    return group;
  }

  removeSpirit(spiritId: string): void {
    const spirit = this.spirits.get(spiritId);
    if (spirit?.mesh && this.scene) {
      this.scene.remove(spirit.mesh);
      spirit.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
    this.spirits.delete(spiritId);
  }

  collectSpirit(spiritId: string): Spirit | null {
    const spirit = this.spirits.get(spiritId);
    if (!spirit || spirit.collected) return null;
    spirit.collected = true;
    this.collected.push(spirit);
    this.removeSpirit(spiritId);
    localStorage.setItem('kodama-spirits', JSON.stringify(
      this.collected.map(s => ({ id: s.id, type: s.type, position: s.position, spawnTime: s.spawnTime, collected: s.collected }))
    ));
    this.eventBus.emit('spirit:collected', spirit);
    return spirit;
  }

  getActiveSpirits(): Spirit[] {
    return Array.from(this.spirits.values());
  }

  getCollectedSpirits(): Spirit[] {
    return this.collected;
  }

  update(delta: number): void {
    this.time += delta;
    this.spirits.forEach((spirit) => {
      if (spirit.mesh) {
        spirit.mesh.position.y = Math.sin(this.time * 2 + spirit.spawnTime * 0.001) * 0.1;
        spirit.mesh.rotation.y += delta * 0.8;
        const scale = 1 + Math.sin(this.time * 3 + spirit.spawnTime * 0.001) * 0.05;
        spirit.mesh.scale.setScalar(scale);
      }
    });
  }

  cleanup(): void {
    const now = Date.now();
    const DESPAWN_TIME = 5 * 60 * 1000;
    this.spirits.forEach((spirit, id) => {
      if (now - spirit.spawnTime > DESPAWN_TIME) {
        this.removeSpirit(id);
        this.eventBus.emit('spirit:despawned', { id });
      }
    });
  }
}
