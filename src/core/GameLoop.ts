export class GameLoop {
  private running = false;
  private lastTime = 0;
  private callbacks: Array<(delta: number, time: number) => void> = [];
  private rafId: number | null = null;

  addCallback(cb: (delta: number, time: number) => void): void {
    this.callbacks.push(cb);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop.bind(this));
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private loop(time: number): void {
    if (!this.running) return;
    const delta = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;
    this.callbacks.forEach(cb => cb(delta, time));
    this.rafId = requestAnimationFrame(this.loop.bind(this));
  }
}
