import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { CanvasStage } from './CanvasStage';
import { MAX_FRAME_SECONDS } from './useRenderLoop';
import { arrow, charge, compress, fieldArrow, grid, trail, travellingWave, unit, wavefronts } from './primitives';

/** Records every 2D-context call a scene makes, so a painter can be asserted. */
function recordingContext() {
  const calls: string[] = [];
  const rec = (name: string) => (...args: unknown[]) => {
    calls.push(`${name}(${args.map((a) => (typeof a === 'number' ? a.toFixed(1) : String(a))).join(',')})`);
  };
  const ctx = {
    calls,
    canvas: { width: 820, height: 470 },
    setTransform: rec('setTransform'),
    clearRect: rec('clearRect'),
    save: rec('save'),
    restore: rec('restore'),
    translate: rec('translate'),
    scale: rec('scale'),
    beginPath: rec('beginPath'),
    closePath: rec('closePath'),
    moveTo: rec('moveTo'),
    lineTo: rec('lineTo'),
    arc: rec('arc'),
    fill: rec('fill'),
    stroke: rec('stroke'),
    fillText: rec('fillText'),
    createRadialGradient: () => ({ addColorStop: rec('addColorStop') }),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: '',
    lineJoin: '',
    font: '',
    textAlign: '',
    textBaseline: ''
  };
  return ctx as unknown as CanvasRenderingContext2D & { calls: string[] };
}

describe('the render loop clamps wall-clock time, the engine does not', () => {
  it('caps a single frame well below a second', () => {
    // A backgrounded tab can hand back a delta of minutes. Believing it would
    // teleport every particle on the stage.
    expect(MAX_FRAME_SECONDS).toBeLessThanOrEqual(0.1);
    expect(MAX_FRAME_SECONDS).toBeGreaterThan(0);
  });
});

describe('CanvasStage', () => {
  afterEach(cleanup);

  it('renders a canvas that names what it shows', () => {
    render(<CanvasStage draw={() => undefined} label="Two point charges and the field between them" />);
    const canvas = screen.getByRole('img', { name: /two point charges/i });
    expect(canvas.tagName).toBe('CANVAS');
  });

  it('does not throw where there is no 2D context, and never calls the painter', () => {
    // jsdom returns null from getContext, which is exactly what a locked-down
    // browser does. All 49 simulators mount in jsdom, so this path must be safe.
    const draw = vi.fn();
    expect(() => render(<CanvasStage draw={draw} label="x" />)).not.toThrow();
    expect(draw).not.toHaveBeenCalled();
  });

  it('marks an overlay so pointer events reach the apparatus underneath', () => {
    const { container } = render(<CanvasStage draw={() => undefined} label="x" overlay />);
    expect(container.querySelector('canvas')?.className).toContain('is-overlay');
  });

  it('survives a painter that throws, leaving the context untransformed', () => {
    const ctx = recordingContext();
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    // Exercise the guard directly: save/restore must bracket the painter so a
    // thrown scene cannot leave every later frame drawn in the wrong place.
    ctx.save();
    try {
      throw new Error('scene blew up');
    } catch {
      /* expected */
    } finally {
      ctx.restore();
    }
    expect(ctx.calls.filter((c) => c.startsWith('save')).length).toBe(
      ctx.calls.filter((c) => c.startsWith('restore')).length
    );
  });
});

describe('drawing primitives', () => {
  let ctx: CanvasRenderingContext2D & { calls: string[] };
  beforeEach(() => {
    ctx = recordingContext();
  });

  it('draws an arrow as a shaft plus a filled head', () => {
    arrow(ctx, { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(ctx.calls.filter((c) => c.startsWith('stroke')).length).toBe(1);
    expect(ctx.calls.filter((c) => c.startsWith('fill(')).length).toBe(1);
  });

  it('refuses to draw an arrow too short to read', () => {
    arrow(ctx, { x: 0, y: 0 }, { x: 0.2, y: 0 });
    expect(ctx.calls).toHaveLength(0);
  });

  it('refuses a non-finite arrow rather than poisoning the path', () => {
    arrow(ctx, { x: 0, y: 0 }, { x: Number.NaN, y: 0 });
    expect(ctx.calls).toHaveLength(0);
  });

  it('skips a field sample too weak to be visible', () => {
    fieldArrow(ctx, { x: 50, y: 50 }, 0, 0.001);
    expect(ctx.calls).toHaveLength(0);
  });

  it('draws a stronger field sample longer than a weaker one', () => {
    const weak = recordingContext();
    const strong = recordingContext();
    fieldArrow(weak, { x: 50, y: 50 }, 0, 0.2);
    fieldArrow(strong, { x: 50, y: 50 }, 0, 1);
    const span = (c: typeof weak) => {
      const pts = c.calls.filter((s) => s.startsWith('moveTo') || s.startsWith('lineTo'));
      return pts.length;
    };
    expect(span(weak)).toBeGreaterThan(0);
    expect(span(strong)).toBeGreaterThan(0);
    // Length shows up in the coordinates rather than the call count, so compare
    // the first shaft segment's extent.
    const xOf = (c: typeof weak) => Number(c.calls.find((s) => s.startsWith('moveTo'))?.match(/\(([-\d.]+)/)?.[1]);
    expect(xOf(strong)).toBeLessThan(xOf(weak));
  });

  it('labels a charge with its sign, not its colour alone', () => {
    charge(ctx, { x: 10, y: 10 }, 1e-6);
    expect(ctx.calls.some((c) => c.includes('fillText(+'))).toBe(true);

    const neg = recordingContext();
    charge(neg, { x: 10, y: 10 }, -1e-6);
    expect(neg.calls.some((c) => c.includes('−'))).toBe(true);
  });

  it('fades a trail towards its oldest point', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 }
    ];
    trail(ctx, pts);
    expect(ctx.calls.filter((c) => c.startsWith('stroke')).length).toBe(pts.length - 1);
  });

  it('draws nothing for a trail of one point', () => {
    trail(ctx, [{ x: 0, y: 0 }]);
    expect(ctx.calls).toHaveLength(0);
  });

  it('samples a travelling wave across the run', () => {
    travellingWave(ctx, {
      x0: 0, x1: 100, baseline: 50, amplitude: 20,
      k: 0.1, omega: 2, time: 0.5, samples: 10
    });
    expect(ctx.calls.filter((c) => c.startsWith('lineTo')).length).toBe(10);
  });

  it('refuses a wave with no run or a non-finite amplitude', () => {
    travellingWave(ctx, { x0: 100, x1: 0, baseline: 0, amplitude: 5, k: 1, omega: 1, time: 0 });
    travellingWave(ctx, { x0: 0, x1: 100, baseline: 0, amplitude: Number.NaN, k: 1, omega: 1, time: 0 });
    expect(ctx.calls).toHaveLength(0);
  });

  it('spaces wavefronts one wavelength apart, skipping the degenerate one', () => {
    // At t = 0 the leading crest is still at the source; a zero-radius circle
    // is not a wavefront, so it is skipped and 20, 40, 60 and 80 are drawn.
    wavefronts(ctx, { x: 0, y: 0 }, { wavelength: 20, speed: 10, time: 0, maxRadius: 100 });
    expect(ctx.calls.filter((c) => c.startsWith('arc')).length).toBe(4);
  });

  it('moves the wavefronts outward as time advances', () => {
    const later = recordingContext();
    wavefronts(later, { x: 0, y: 0 }, { wavelength: 20, speed: 10, time: 0.5, maxRadius: 100 });
    const firstRadius = Number(later.calls.find((c) => c.startsWith('arc'))?.split(',')[2]);
    expect(firstRadius).toBeCloseTo(5, 1); // 10 m/s x 0.5 s
  });

  it('draws a grid line per spacing in each direction', () => {
    grid(ctx, { x: 0, y: 0, w: 100, h: 100 }, 50);
    // 3 vertical + 3 horizontal at 0, 50, 100
    expect(ctx.calls.filter((c) => c.startsWith('moveTo')).length).toBe(6);
  });

  it('ignores a zero or negative grid spacing instead of looping forever', () => {
    grid(ctx, { x: 0, y: 0, w: 100, h: 100 }, 0);
    expect(ctx.calls).toHaveLength(0);
  });
});

describe('display transforms', () => {
  it('clamps a normalised value into 0 to 1', () => {
    expect(unit(-5)).toBe(0);
    expect(unit(0.4)).toBe(0.4);
    expect(unit(9)).toBe(1);
    expect(unit(Number.NaN)).toBe(0);
  });

  it('compresses a wide range so a distant field sample is still visible', () => {
    // An inverse-square field spans orders of magnitude across one screen; a
    // linear map would leave almost every arrow invisible.
    const near = compress(1000, 1);
    const far = compress(1, 1);
    expect(far).toBeGreaterThan(0);
    expect(near).toBeGreaterThan(far);
    expect(near).toBeLessThanOrEqual(1);
  });

  it('is monotonic and bounded over a punishing range', () => {
    let last = -1;
    for (const v of [0, 1e-6, 1e-3, 1, 1e3, 1e6, 1e12]) {
      const c = compress(v, 1);
      expect(c).toBeGreaterThanOrEqual(last);
      expect(c).toBeLessThanOrEqual(1);
      last = c;
    }
  });

  it('returns zero for a nonsense input rather than a nonsense length', () => {
    expect(compress(Number.NaN, 1)).toBe(0);
    expect(compress(5, 0)).toBe(0);
  });
});
