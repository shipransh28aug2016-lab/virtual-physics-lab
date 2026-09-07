import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioBus, audioSupported } from './bus';
import { CUES, CUE_NAMES } from './sounds';

/** A minimal Web Audio stand-in that records what the bus asked it to build. */
function fakeAudioContext() {
  const started: number[] = [];
  const nodes = { oscillators: 0, buffers: 0, gains: 0, filters: 0 };
  const connectable = <T extends object>(o: T) => Object.assign(o, { connect: vi.fn(() => connectable({})) });
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn()
  });
  return class {
    currentTime = 0;
    sampleRate = 44100;
    state: AudioContextState = 'running';
    destination = {};
    resume = vi.fn();
    suspend = vi.fn();
    close = vi.fn();
    static log = { started, nodes };
    createGain() {
      nodes.gains += 1;
      return connectable({ gain: param() });
    }
    createBiquadFilter() {
      nodes.filters += 1;
      return connectable({ type: '', frequency: param(), Q: param() });
    }
    createOscillator() {
      nodes.oscillators += 1;
      return connectable({
        type: 'sine',
        frequency: param(),
        start: vi.fn((t: number) => started.push(t)),
        stop: vi.fn()
      });
    }
    createBuffer(_ch: number, frames: number) {
      const data = new Float32Array(frames);
      return { getChannelData: () => data };
    }
    createBufferSource() {
      nodes.buffers += 1;
      return connectable({ buffer: null, start: vi.fn((t: number) => started.push(t)), stop: vi.fn() });
    }
  };
}

describe('cue table', () => {
  it('gives every cue at least one layer and a stated meaning', () => {
    for (const name of CUE_NAMES) {
      expect(CUES[name].layers.length, name).toBeGreaterThan(0);
      expect(CUES[name].meaning.length, name).toBeGreaterThan(8);
    }
  });

  it('keeps every layer short enough to be a cue, not a sound effect', () => {
    for (const name of CUE_NAMES) {
      for (const l of CUES[name].layers) {
        expect(l.duration, name).toBeLessThanOrEqual(0.2);
        expect(l.gain, name).toBeLessThanOrEqual(0.6);
      }
    }
  });
});

describe('audio bus without Web Audio', () => {
  beforeEach(() => {
    // jsdom ships no AudioContext, which is exactly the fallback path.
    delete (window as unknown as Record<string, unknown>).AudioContext;
    delete (window as unknown as Record<string, unknown>).webkitAudioContext;
  });

  it('reports the environment honestly', () => {
    expect(audioSupported()).toBe(false);
  });

  it('never throws and never claims to have played', () => {
    const bus = new AudioBus();
    bus.configure({ enabled: true, volume: 1 });
    for (const name of CUE_NAMES) expect(bus.play(name)).toBe(false);
    expect(() => bus.resume()).not.toThrow();
    expect(() => bus.dispose()).not.toThrow();
  });

  it('still records what was requested, so the visual channel can be checked', () => {
    const bus = new AudioBus();
    bus.play('plug');
    bus.play('error');
    expect(bus.history).toEqual(['plug', 'error']);
  });
});

describe('audio bus with Web Audio', () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>).AudioContext = fakeAudioContext();
  });

  it('stays silent until it is enabled', () => {
    const bus = new AudioBus();
    expect(bus.isEnabled).toBe(false);
    expect(bus.play('switchOn')).toBe(false);
  });

  it('plays once enabled, and stops again when muted', () => {
    const bus = new AudioBus();
    bus.configure({ enabled: true, volume: 0.5 });
    expect(bus.play('switchOn')).toBe(true);
    bus.configure({ enabled: false });
    expect(bus.play('switchOn')).toBe(false);
  });

  it('renders every cue in the table without throwing', () => {
    const bus = new AudioBus();
    bus.configure({ enabled: true, volume: 0.8 });
    for (const name of CUE_NAMES) expect(bus.play(name), name).toBe(true);
    bus.dispose();
  });

  it('clamps the volume rather than trusting the caller', () => {
    const bus = new AudioBus();
    expect(() => bus.configure({ enabled: true, volume: 9 })).not.toThrow();
    expect(() => bus.configure({ enabled: true, volume: -3 })).not.toThrow();
    expect(bus.play('needle')).toBe(true);
  });
});
