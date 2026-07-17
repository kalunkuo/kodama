export type Zone = 'ramble' | 'central_park' | 'offsite';

// Geofence, not geometry (plan §8): canopy GPS drift is 10–30m, so real
// position never maps into the game world. Rectangles are plenty.
const RAMBLE = { swLat: 40.7755, swLon: -73.9725, neLat: 40.7795, neLon: -73.9665 };
const CENTRAL_PARK = { swLat: 40.7644, swLon: -73.9818, neLat: 40.8006, neLon: -73.9494 };

function inRect(lat: number, lon: number, r: typeof RAMBLE): boolean {
  return lat >= r.swLat && lat <= r.neLat && lon >= r.swLon && lon <= r.neLon;
}

export class LocationSystem {
  zone: Zone = 'offsite';
  enabled = false;
  error: string | null = null;
  onZoneChange: ((zone: Zone) => void) | null = null;
  private watchId: number | null = null;

  constructor() {
    // free QA for spawn testing; no anti-spoofing by design (plan §8)
    const override = new URLSearchParams(window.location.search).get('zone');
    if (override === 'ramble' || override === 'central_park') {
      this.zone = override;
      this.enabled = true;
    }
  }

  /** Called from the explicit "Enable park mode" button — never on load (plan §8). */
  enable(): void {
    if (this.enabled || !('geolocation' in navigator)) return;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        this.enabled = true;
        this.error = null;
        const { latitude, longitude } = pos.coords;
        const zone: Zone = inRect(latitude, longitude, RAMBLE)
          ? 'ramble'
          : inRect(latitude, longitude, CENTRAL_PARK)
            ? 'central_park'
            : 'offsite';
        if (zone !== this.zone) {
          this.zone = zone;
          this.onZoneChange?.(zone);
        }
      },
      (err) => {
        this.error = err.message;
        this.enabled = false;
      },
      { enableHighAccuracy: false }
    );
  }

  disable(): void {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
    this.enabled = false;
    this.zone = 'offsite';
    this.onZoneChange?.('offsite');
  }
}
