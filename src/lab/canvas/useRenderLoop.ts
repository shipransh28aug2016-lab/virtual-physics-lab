import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/hooks/useAnimation';

export interface Frame {
  /** Seconds since the loop started. */
  time: number;
  /** Seconds since the previous frame, already clamped to something sane. */
  dt: number;
  /** Frame counter, from 1. */
  count: number;
}

/**
 * The largest wall-clock gap a single frame is allowed to claim, in seconds.
 *
 * A backgrounded tab stops firing animation frames; when it wakes, the first
 * delta can be minutes. Believing it would teleport every particle. Clamping
 * belongs *here*, in the thing that measures wall-clock time — the engine
 * integrates exactly the interval it is handed and never silently drops any.
 */
export const MAX_FRAME_SECONDS = 1 / 20;

/**
 * A `requestAnimationFrame` loop that never touches React state.
 *
 * The callback is kept in a ref and re-read each frame, so a component can
 * close over fresh props without the loop being torn down and restarted — which
 * is what would otherwise drop a frame on every render. Honours both the OS
 * reduced-motion setting and the in-app motion preference: under either the
 * loop does not run, and the caller is invoked once with `dt = 0` so it can
 * still paint a correct static frame.
 */
export function useRenderLoop(
  frame: (f: Frame) => void,
  options: { active?: boolean; respectReducedMotion?: boolean } = {}
): void {
  const { active = true, respectReducedMotion = true } = options;
  const cb = useRef(frame);
  cb.current = frame;
  const reduced = useReducedMotion();
  const still = respectReducedMotion && reduced;

  useEffect(() => {
    if (!active) return;
    if (typeof requestAnimationFrame !== 'function') {
      // jsdom and server rendering: paint once, statically, and stop.
      cb.current({ time: 0, dt: 0, count: 1 });
      return;
    }
    if (still) {
      cb.current({ time: 0, dt: 0, count: 1 });
      return;
    }

    let raf = 0;
    let count = 0;
    const t0 = performance.now();
    let last = t0;

    const tick = (now: number) => {
      count += 1;
      const dt = Math.min((now - last) / 1000, MAX_FRAME_SECONDS);
      last = now;
      cb.current({ time: (now - t0) / 1000, dt, count });
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, still]);
}
