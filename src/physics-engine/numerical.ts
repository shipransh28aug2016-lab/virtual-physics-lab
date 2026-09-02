/** Evenly spaced samples across [start, end], inclusive of both ends. */
export function linspace(start: number, end: number, count: number): number[] {
  if (count <= 1) return [start];
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, i) => start + i * step);
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Trapezoidal integral of f over [a, b] with n panels. */
export function integrate(f: (x: number) => number, a: number, b: number, n = 400): number {
  if (n < 1) return 0;
  const h = (b - a) / n;
  let sum = (f(a) + f(b)) / 2;
  for (let i = 1; i < n; i += 1) sum += f(a + i * h);
  return sum * h;
}

/**
 * Bisection root finder. Returns NaN when the bracket does not straddle a root,
 * so callers never mistake a non-convergence for a real answer.
 */
export function bisect(
  f: (x: number) => number,
  lo: number,
  hi: number,
  tolerance = 1e-10,
  maxIterations = 200
): number {
  let a = lo;
  let b = hi;
  let fa = f(a);
  const fb = f(b);
  if (!Number.isFinite(fa) || !Number.isFinite(fb) || fa * fb > 0) return Number.NaN;
  for (let i = 0; i < maxIterations && (b - a) / 2 > tolerance; i += 1) {
    const mid = (a + b) / 2;
    const fm = f(mid);
    if (fm === 0) return mid;
    if (fa * fm < 0) {
      b = mid;
    } else {
      a = mid;
      fa = fm;
    }
  }
  return (a + b) / 2;
}

/** Least-squares fit y = m·x + c, with the coefficient of determination. */
export function linearFit(points: { x: number; y: number }[]): {
  slope: number;
  intercept: number;
  r2: number;
} {
  const n = points.length;
  if (n < 2) return { slope: Number.NaN, intercept: Number.NaN, r2: Number.NaN };
  const sx = points.reduce((s, p) => s + p.x, 0);
  const sy = points.reduce((s, p) => s + p.y, 0);
  const sxx = points.reduce((s, p) => s + p.x * p.x, 0);
  const sxy = points.reduce((s, p) => s + p.x * p.y, 0);
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-15) return { slope: Number.NaN, intercept: Number.NaN, r2: Number.NaN };
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  const mean = sy / n;
  const ssTot = points.reduce((s, p) => s + (p.y - mean) ** 2, 0);
  const ssRes = points.reduce((s, p) => s + (p.y - (slope * p.x + intercept)) ** 2, 0);
  return { slope, intercept, r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot };
}
