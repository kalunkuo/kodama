import * as THREE from 'three';
import type mapboxgl from 'mapbox-gl';
import type { Coordinates } from '../player/GPSService';

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

export class TerrainLayer {
  private scene: THREE.Scene | null = null;
  private camera: THREE.Camera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private particles: Particle[] = [];
  private particleMeshes: THREE.Points | null = null;

  init(map: mapboxgl.Map): void {
    const customLayer: mapboxgl.CustomLayerInterface = {
      id: 'terrain-layer',
      type: 'custom',
      renderingMode: '3d',
      onAdd: (m, gl) => {
        this.scene = new THREE.Scene();
        this.camera = new THREE.Camera();
        this.renderer = new THREE.WebGLRenderer({
          canvas: m.getCanvas(),
          context: gl as WebGLRenderingContext,
          antialias: true,
        });
        this.renderer.autoClear = false;
        this.initParticles();
      },
      render: (_gl, matrix) => {
        if (!this.scene || !this.camera || !this.renderer) return;
        const m = new THREE.Matrix4().fromArray(matrix as number[]);
        (this.camera as THREE.PerspectiveCamera).projectionMatrix = m;
        this.updateParticles();
        this.renderer.resetState();
        this.renderer.render(this.scene, this.camera);
        map.triggerRepaint();
      },
    };

    map.on('load', () => {
      try {
        map.addLayer(customLayer);
      } catch (e) {
        console.warn('Could not add terrain layer:', e);
      }
    });
  }

  private initParticles(): void {
    if (!this.scene) return;
    const count = 50;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const p: Particle = {
        x: (Math.random() - 0.5) * 0.001,
        y: (Math.random() - 0.5) * 0.001,
        z: Math.random() * 0.0005,
        vx: (Math.random() - 0.5) * 0.00001,
        vy: (Math.random() - 0.5) * 0.00001,
        vz: Math.random() * 0.000005,
        life: Math.random(),
        maxLife: 0.5 + Math.random() * 0.5,
      };
      this.particles.push(p);
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      colors[i * 3] = 0.27;
      colors[i * 3 + 1] = 0.77;
      colors[i * 3 + 2] = 0.37;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.0001,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
    });

    this.particleMeshes = new THREE.Points(geo, mat);
    this.scene.add(this.particleMeshes);
  }

  private updateParticles(): void {
    if (!this.particleMeshes) return;
    const positions = this.particleMeshes.geometry.attributes['position'].array as Float32Array;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;
      p.life += 0.005;
      if (p.life >= p.maxLife) {
        p.x = (Math.random() - 0.5) * 0.001;
        p.y = (Math.random() - 0.5) * 0.001;
        p.z = 0;
        p.life = 0;
      }
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
    }
    this.particleMeshes.geometry.attributes['position'].needsUpdate = true;
  }

  update(_center: Coordinates): void {
    // Camera follows player - handled by Mapbox camera
  }
}
