import { useEffect, useRef, useState } from 'react';

/** Mirrors the OS "reduce motion" setting; animations must honour it. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  return reduced;
}

/**
 * Runs `frame` on every animation frame without ever touching React state, so
 * an animated instrument stays at 60 fps. `frame` receives the elapsed time in
 * seconds. The loop is skipped entirely when motion is reduced or `active` is
 * false.
 */
export function useRafLoop(frame: (elapsedSeconds: number) => void, active = true): void {
  const cb = useRef(frame);
  cb.current = frame;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!active || reduced) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      cb.current((now - t0) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, reduced]);
}

/** Throttles a value so graphs re-render at a readable rate, not per frame. */
export function useThrottled<T>(value: T, intervalMs = 120): T {
  const [held, setHeld] = useState(value);
  const last = useRef(0);
  const pending = useRef<number | null>(null);

  useEffect(() => {
    const now = performance.now();
    const wait = Math.max(0, intervalMs - (now - last.current));
    if (pending.current !== null) window.clearTimeout(pending.current);
    pending.current = window.setTimeout(() => {
      last.current = performance.now();
      setHeld(value);
      pending.current = null;
    }, wait);
    return () => {
      if (pending.current !== null) window.clearTimeout(pending.current);
    };
  }, [value, intervalMs]);

  return held;
}
