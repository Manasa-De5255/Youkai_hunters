export type SanctuaryAudioState = 'stopped' | 'playing' | 'paused';

const HIRAJOSHI_FREQS = [146.83, 164.81, 174.61, 220.0, 233.08, 293.66, 329.63, 349.23, 440.0];

class SanctuaryAudioController {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneOscA: OscillatorNode | null = null;
  private droneOscB: OscillatorNode | null = null;
  private chimeTimer: number | null = null;
  private state: SanctuaryAudioState = 'stopped';
  private muted = false;
  private step = 0;
  private listeners = new Set<(state: SanctuaryAudioState) => void>();

  private notify() {
    for (const cb of this.listeners) {
      cb(this.state);
    }
  }

  subscribe(cb: (state: SanctuaryAudioState) => void): () => void {
    this.listeners.add(cb);
    cb(this.state);
    return () => {
      this.listeners.delete(cb);
    };
  }

  getState(): SanctuaryAudioState {
    return this.state;
  }

  isMuted(): boolean {
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.ctx) return this.ctx;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    try {
      const ctx = new AudioCtx();
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.14;
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.masterGain = master;
      return ctx;
    } catch {
      return null;
    }
  }

  private startChimeLoop() {
    if (this.chimeTimer !== null || typeof window === 'undefined') return;
    this.chimeTimer = window.setInterval(() => {
      if (this.state !== 'playing' || this.muted) return;
      const ctx = this.ctx;
      const master = this.masterGain;
      if (!ctx || !master || ctx.state !== 'running') return;
      try {
        const now = ctx.currentTime;
        const freq = HIRAJOSHI_FREQS[(this.step * 3 + 1) % HIRAJOSHI_FREQS.length];
        this.step += 1;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.11, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
        osc.connect(gain);
        gain.connect(master);
        osc.start(now);
        osc.stop(now + 1.65);
      } catch {
        // Ignore transient Web Audio errors in headless environments
      }
    }, 1850);
  }

  ensureStarted(): void {
    const ctx = this.ensureContext();
    if (ctx && this.masterGain && !this.droneOscA) {
      try {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 340;
        filter.connect(this.masterGain);

        const oscA = ctx.createOscillator();
        oscA.type = 'sine';
        oscA.frequency.value = 73.42; // D2 supernatural forest drone
        const gainA = ctx.createGain();
        gainA.gain.value = 0.28;
        oscA.connect(gainA);
        gainA.connect(filter);
        oscA.start();

        const oscB = ctx.createOscillator();
        oscB.type = 'triangle';
        oscB.frequency.value = 110.0; // A2 fifth harmonic
        const gainB = ctx.createGain();
        gainB.gain.value = 0.12;
        oscB.connect(gainB);
        gainB.connect(filter);
        oscB.start();

        this.droneOscA = oscA;
        this.droneOscB = oscB;
      } catch {
        // Ignore
      }
    }

    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => undefined);
    }

    if (this.state !== 'playing') {
      this.state = 'playing';
      this.startChimeLoop();
      this.notify();
    }
  }

  pause(): void {
    if (this.state === 'stopped') return;
    if (this.ctx && this.ctx.state === 'running') {
      void this.ctx.suspend().catch(() => undefined);
    }
    if (this.state !== 'paused') {
      this.state = 'paused';
      this.notify();
    }
  }

  resume(): void {
    if (this.state === 'stopped') {
      this.ensureStarted();
      return;
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => undefined);
    }
    if (this.state !== 'playing') {
      this.state = 'playing';
      this.startChimeLoop();
      this.notify();
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.14, this.ctx.currentTime, 0.04);
    }
  }

  playArrowShot(): void {
    if (this.muted || this.state === 'paused') return;
    this.ensureStarted();
    const ctx = this.ctx;
    const master = this.masterGain;
    if (!ctx || !master) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + 0.14);
    } catch {
      // Ignore
    }
  }

  playGhostHit(special: boolean): void {
    if (this.muted || this.state === 'paused') return;
    const ctx = this.ctx;
    const master = this.masterGain;
    if (!ctx || !master) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(special ? 659.25 : 523.25, now);
      osc.frequency.exponentialRampToValueAtTime(special ? 987.77 : 783.99, now + 0.16);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // Ignore
    }
  }

  stop(): void {
    if (this.chimeTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.chimeTimer);
      this.chimeTimer = null;
    }
    try {
      this.droneOscA?.stop();
      this.droneOscB?.stop();
    } catch {
      // Ignore
    }
    this.droneOscA = null;
    this.droneOscB = null;
    if (this.ctx) {
      void this.ctx.close().catch(() => undefined);
      this.ctx = null;
      this.masterGain = null;
    }
    if (this.state !== 'stopped') {
      this.state = 'stopped';
      this.notify();
    }
  }
}

export const sanctuaryAudio = new SanctuaryAudioController();
