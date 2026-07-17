// Tiny WebAudio synth — no audio assets to license, unlocked on first pointer
// event (iOS requirement, plan §10).
export class AudioSystem {
  enabled = true;
  private ctx: AudioContext | null = null;

  unlock(): void {
    if (this.ctx) return;
    try {
      this.ctx = new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  private tone(freqStart: number, freqEnd: number, durMs: number, type: OscillatorType, gain = 0.08): void {
    if (!this.enabled || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + durMs / 1000);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + durMs / 1000 + 0.02);
  }

  whistle(): void {
    this.tone(700, 1400, 380, 'sine', 0.1);
  }

  chime(): void {
    this.tone(880, 880, 140, 'triangle');
    setTimeout(() => this.tone(1320, 1320, 220, 'triangle'), 110);
  }

  pop(): void {
    this.tone(300, 140, 90, 'square', 0.05);
  }

  fail(): void {
    this.tone(280, 130, 260, 'sawtooth', 0.05);
  }

  step(): void {
    this.tone(520, 480, 40, 'sine', 0.02);
  }
}

export const audio = new AudioSystem();
