import mapboxgl from 'mapbox-gl';
import type { Coordinates } from '../player/GPSService';
import type { Spirit } from '../spirits/SpiritManager';

const MAPBOX_TOKEN = import.meta.env['VITE_MAPBOX_TOKEN'] ?? '';

export class MapManager {
  private map: mapboxgl.Map | null = null;
  private playerMarker: mapboxgl.Marker | null = null;
  private spiritMarkers: Map<string, mapboxgl.Marker> = new Map();
  private usingFallback = false;

  constructor(private containerId: string) {}

  async init(center: [number, number]): Promise<void> {
    if (!MAPBOX_TOKEN) {
      console.warn('Mapbox token not configured. Using fallback background.');
      this.initFallback(center);
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;

    return new Promise((resolve) => {
      try {
        this.map = new mapboxgl.Map({
          container: this.containerId,
          style: 'mapbox://styles/mapbox/outdoors-v12',
          center: center,
          zoom: 15,
          pitch: 45,
        });

        this.map.on('load', () => {
          this.createPlayerMarker(center);
          resolve();
        });

        this.map.on('error', (e) => {
          console.warn('Mapbox error:', e);
          this.initFallback(center);
          resolve();
        });
      } catch (err) {
        console.warn('Mapbox init failed:', err);
        this.initFallback(center);
        resolve();
      }
    });
  }

  private initFallback(_center: [number, number]): void {
    this.usingFallback = true;
    const container = document.getElementById(this.containerId);
    if (!container) return;
    container.style.background = 'radial-gradient(ellipse at center, #1a2744 0%, #0a0f1e 100%)';
    container.innerHTML = `
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;color:#4ade80;opacity:0.6;">
        <div style="font-size:48px">🌲</div>
        <div style="font-size:14px;letter-spacing:2px;text-transform:uppercase">Map Unavailable</div>
        <div style="font-size:11px;opacity:0.7;text-align:center;padding:0 20px">Add your Mapbox token to enable the map</div>
      </div>
    `;
  }

  private createPlayerMarker(lngLat: [number, number]): void {
    if (!this.map) return;
    const el = document.createElement('div');
    el.className = 'player-marker';
    el.innerHTML = `
      <div class="player-dot"></div>
      <div class="player-pulse"></div>
    `;
    this.playerMarker = new mapboxgl.Marker({ element: el })
      .setLngLat(lngLat)
      .addTo(this.map);
  }

  updatePlayerPosition(coords: Coordinates): void {
    if (this.usingFallback || !this.map) return;
    const lngLat: [number, number] = [coords.lng, coords.lat];
    if (this.playerMarker) {
      this.playerMarker.setLngLat(lngLat);
    } else {
      this.createPlayerMarker(lngLat);
    }
  }

  hasSpiritMarker(spiritId: string): boolean {
    return this.spiritMarkers.has(spiritId);
  }

  addSpiritMarker(spirit: Spirit, onClick: (spiritId: string) => void): void {
    if (this.usingFallback || !this.map) return;
    const el = document.createElement('div');
    el.className = 'spirit-marker';
    el.style.setProperty('--glow-color', spirit.type.glowColor);
    el.innerHTML = `<div class="spirit-dot" style="background:${spirit.type.glowColor}"></div>`;
    el.addEventListener('click', () => onClick(spirit.id));

    const marker = new mapboxgl.Marker({ element: el })
      .setLngLat([spirit.position.lng, spirit.position.lat])
      .addTo(this.map);

    this.spiritMarkers.set(spirit.id, marker);
  }

  removeSpiritMarker(spiritId: string): void {
    const marker = this.spiritMarkers.get(spiritId);
    if (marker) {
      marker.remove();
      this.spiritMarkers.delete(spiritId);
    }
  }

  followPlayer(coords: Coordinates): void {
    if (this.usingFallback || !this.map) return;
    this.map.easeTo({
      center: [coords.lng, coords.lat],
      duration: 500,
    });
  }

  getMap(): mapboxgl.Map | null {
    return this.map;
  }
}
