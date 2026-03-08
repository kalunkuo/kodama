export interface Coordinates {
  lat: number;
  lng: number;
  accuracy?: number;
}

export class GPSService {
  private mockMode = false;
  private mockPosition: Coordinates = { lat: 37.7749, lng: -122.4194 };
  private watchId: number | null = null;
  private listeners: Array<(coords: Coordinates) => void> = [];
  private currentPosition: Coordinates | null = null;

  enableMockMode(initialPosition?: Coordinates): void {
    this.mockMode = true;
    if (initialPosition) {
      this.mockPosition = { ...initialPosition };
    }
    this.currentPosition = { ...this.mockPosition };
    this.notifyListeners(this.currentPosition);
  }

  setMockPosition(coords: Coordinates): void {
    this.mockPosition = { ...coords };
    this.currentPosition = { ...coords };
    this.notifyListeners(this.currentPosition);
  }

  moveMockPosition(dlat: number, dlng: number): void {
    this.mockPosition = {
      lat: this.mockPosition.lat + dlat,
      lng: this.mockPosition.lng + dlng,
    };
    this.currentPosition = { ...this.mockPosition };
    this.notifyListeners(this.currentPosition);
  }

  startTracking(): void {
    if (this.mockMode) {
      this.currentPosition = { ...this.mockPosition };
      this.notifyListeners(this.currentPosition);
      return;
    }
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported, enabling mock mode');
      this.enableMockMode();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: Coordinates = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        this.currentPosition = coords;
        this.notifyListeners(coords);
      },
      () => {
        console.warn('GPS failed, enabling mock mode');
        this.enableMockMode();
      }
    );
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords: Coordinates = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        this.currentPosition = coords;
        this.notifyListeners(coords);
      },
      (err) => {
        console.warn('GPS watch error:', err);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }

  stopTracking(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  getCurrentPosition(): Coordinates | null {
    return this.currentPosition;
  }

  onPositionUpdate(cb: (coords: Coordinates) => void): void {
    this.listeners.push(cb);
  }

  private notifyListeners(coords: Coordinates): void {
    this.listeners.forEach(cb => cb(coords));
  }

  isMockMode(): boolean {
    return this.mockMode;
  }
}
