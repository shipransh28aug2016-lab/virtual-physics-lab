/**
 * The lab's audio bus.
 *
 * Rules this file enforces, not merely documents:
 *
 *  · **Silent until asked.** Nothing plays before the student has interacted
 *    with the page — every browser's autoplay policy would block it anyway, and
 *    a lab that makes noise on load is a lab a student mutes for good.
 *  · **Never the only channel.** A cue always accompanies a visual change; the
 *    bus has no way to display anything, which is the point.
 *  · **Degrades to nothing.** No Web Audio (jsdom, locked-down browsers, some
 *    `file://` contexts) means every call is a no-op, never a throw.
 *  · **Zero assets.** Cues are synthesised, so the portable single-file build
 *    does not grow.
 */
import { CUES, type CueName } from './sounds';

export interface AudioSettings {
  enabled: boolean;
  /** Master gain, 0–1. */
  volume: number;
}

type Ctor = typeof AudioContext;

const ctorOf = (): Ctor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
};

/** True when this environment can synthesise sound at all. */
export const audioSupported = (): boolean => ctorOf() !== null;

export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private settings: AudioSettings = { enabled: false, volume: 0.6 };
  /** Cues fired since construction — the hook for tests and for QA. */
  private log: CueName[] = [];

  configure(settings: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...settings };
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.gain(), this.ctx.currentTime, 0.01);
    }
    if (!this.settings.enabled) this.suspend();
  }

  get isEnabled(): boolean {
    return this.settings.enabled;
  }

  /** Cue names played so far, oldest first. Used by tests, not by the UI. */
  get history(): readonly CueName[] {
    return this.log;
  }

  clearHistory(): void {
    this.log = [];
  }

  private gain(): number {
    return Math.max(0, Math.min(1, this.settings.volume)) * 0.5;
  }

  /**
   * Lazily creates the context. Called from a user gesture, so the context is
   * allowed to start; called from anywhere else it may stay suspended, which is
   * correct behaviour rather than an error.
   */
  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = ctorOf();
    if (!Ctor) return null;
    try {
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = this.gain();
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      return ctx;
    } catch {
      return null;
    }
  }

  /** Resumes a context the browser suspended. Safe to call repeatedly. */
  resume(): void {
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') void ctx.resume?.();
  }

  private suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend?.();
  }

  /**
   * Plays a cue. Returns whether sound was actually produced, so a caller can
   * tell "muted" from "unsupported" without inspecting the bus.
   */
  play(name: CueName): boolean {
    this.log.push(name);
    if (!this.settings.enabled) return false;
    const ctx = this.ensure();
    const master = this.master;
    if (!ctx || !master) return false;
    if (ctx.state === 'suspended') void ctx.resume?.();

    const cue = CUES[name];
    const t0 = ctx.currentTime;
    try {
      for (const layer of cue.layers) {
        if (layer.kind === 'noise') this.noise(ctx, master, t0, layer);
        else this.tone(ctx, master, t0, layer);
      }
    } catch {
      return false;
    }
    return true;
  }

  private noise(
    ctx: AudioContext,
    out: GainNode,
    t0: number,
    l: Extract<import('./sounds').Layer, { kind: 'noise' }>
  ): void {
    const frames = Math.max(1, Math.floor(ctx.sampleRate * l.duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // A deterministic ramp of pseudo-noise: the cue must sound the same twice.
    let seed = 0x2f6e2b1;
    for (let i = 0; i < frames; i += 1) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (seed / 0x3fffffff - 1) * (1 - i / frames);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = l.filter;
    filter.Q.value = l.q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(l.gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + l.decay);
    src.connect(filter).connect(g).connect(out);
    src.start(t0);
    src.stop(t0 + l.duration);
  }

  private tone(
    ctx: AudioContext,
    out: GainNode,
    t0: number,
    l: Extract<import('./sounds').Layer, { kind: 'tone' }>
  ): void {
    const start = t0 + (l.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = l.type;
    osc.frequency.setValueAtTime(l.freq, start);
    if (l.toFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(l.toFreq, 1), start + l.duration);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(l.gain, start + Math.min(0.008, l.duration / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, start + l.duration);
    osc.connect(g).connect(out);
    osc.start(start);
    osc.stop(start + l.duration + 0.01);
  }

  /** Releases the context. Called when the lab unmounts. */
  dispose(): void {
    try {
      void this.ctx?.close?.();
    } catch {
      /* a context that refuses to close is not worth an exception */
    }
    this.ctx = null;
    this.master = null;
  }
}

/** The one bus the whole lab shares. */
export const labAudio = new AudioBus();
