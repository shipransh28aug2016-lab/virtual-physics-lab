export interface Vec2 {
  x: number;
  y: number;
}

export const vec2 = (x: number, y: number): Vec2 => ({ x, y });
export const add2 = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub2 = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale2 = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });

/** Euclidean magnitude of a planar vector. */
export const mag2 = (a: Vec2): number => Math.hypot(a.x, a.y);

export const dist2 = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Unit vector; the zero vector maps to itself rather than to NaN. */
export function norm2(a: Vec2): Vec2 {
  const m = mag2(a);
  return m === 0 ? { x: 0, y: 0 } : { x: a.x / m, y: a.y / m };
}

export const dot2 = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;

/** Signed z-component of the 2-D cross product. */
export const cross2 = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;

export const angle2 = (a: Vec2): number => Math.atan2(a.y, a.x);

export function rotate2(a: Vec2, radians: number): Vec2 {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}
