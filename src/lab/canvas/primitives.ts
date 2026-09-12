/**
 * The drawing kit every canvas scene shares.
 *
 * Pure 2D-context helpers, authored in the stage's logical coordinates. Nothing
 * here decides physics — each function takes numbers a model already computed
 * and puts them on the screen. Keeping them in one place is what makes a field
 * arrow in electrostatics look like a field arrow in magnetism.
 */

export interface Vec2 {
  x: number;
  y: number;
}

/** The canvas palette. Tuned against the lab's dark stage, not invented per scene. */
export const INK = {
  positive: '#ff6b7d',
  negative: '#5aa9ff',
  field: '#7dd3fc',
  current: '#25d0ee',
  ray: '#ffd257',
  wave: '#6ee7ff',
  neutral: '#94a8bd',
  faint: 'rgba(148, 168, 189, 0.28)',
  hot: '#ffc65c',
  good: '#45d68b'
} as const;

/* ── vectors and arrows ─────────────────────────────────────────────────── */

/** A line with a solid head, the workhorse of every field and force diagram. */
export function arrow(
  ctx: CanvasRenderingContext2D,
  from: Vec2,
  to: Vec2,
  options: { color?: string; width?: number; head?: number; alpha?: number } = {}
): void {
  const { color = INK.field, width = 1.6, head = 7, alpha = 1 } = options;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (!Number.isFinite(len) || len < 0.5) return;

  const ux = dx / len;
  const uy = dy / len;
  // Keep the head proportionate on a very short arrow, or it becomes a blob.
  const h = Math.min(head, len * 0.6);
  const bx = to.x - ux * h;
  const by = to.y - uy * h;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(bx, by);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(bx - uy * h * 0.42, by + ux * h * 0.42);
  ctx.lineTo(bx + uy * h * 0.42, by - ux * h * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * One sample of a vector field, drawn from its centre.
 *
 * `magnitude` is normalised by the caller against the field's own scale, so the
 * arrow length says something about that field rather than about the units the
 * model happens to use. Length is capped: past the cap only the colour changes,
 * because an arrow that leaves the screen tells the student nothing.
 */
export function fieldArrow(
  ctx: CanvasRenderingContext2D,
  at: Vec2,
  angle: number,
  strength: number,
  options: { maxLength?: number; color?: string } = {}
): void {
  const { maxLength = 26, color = INK.field } = options;
  const clamped = Math.max(0, Math.min(1, strength));
  if (clamped < 0.02) return;
  const len = 6 + clamped * (maxLength - 6);
  const half = len / 2;
  arrow(
    ctx,
    { x: at.x - Math.cos(angle) * half, y: at.y - Math.sin(angle) * half },
    { x: at.x + Math.cos(angle) * half, y: at.y + Math.sin(angle) * half },
    { color, width: 1.1 + clamped * 1.6, head: 4 + clamped * 4, alpha: 0.35 + clamped * 0.65 }
  );
}

/* ── charges and particles ──────────────────────────────────────────────── */

/** A point charge. Red for positive, blue for negative — the NCERT convention. */
export function charge(
  ctx: CanvasRenderingContext2D,
  at: Vec2,
  coulombs: number,
  radius = 13,
  label?: string
): void {
  const positive = coulombs >= 0;
  const color = positive ? INK.positive : INK.negative;

  ctx.save();
  const glow = ctx.createRadialGradient(at.x, at.y, radius * 0.4, at.x, at.y, radius * 2.6);
  glow.addColorStop(0, positive ? 'rgba(255,107,125,0.36)' : 'rgba(90,169,255,0.36)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius * 2.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.strokeStyle = positive ? '#8f2f3c' : '#2c5c92';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#0b1119';
  ctx.font = `700 ${Math.round(radius * 1.35)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(positive ? '+' : '−', at.x, at.y + 0.5);

  if (label) {
    ctx.fillStyle = '#b9c7d8';
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(label, at.x, at.y + radius + 13);
  }
  ctx.restore();
}

/** A small moving body — a charge carrier, a photon packet, a test particle. */
export function particle(
  ctx: CanvasRenderingContext2D,
  at: Vec2,
  radius = 2.6,
  color = INK.current,
  alpha = 1
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * The path a body has taken, fading towards the oldest point.
 *
 * Drawn as one gradient-free pass of short segments: a trail is the cheapest
 * honest way to show a trajectory's history, and it is what makes a cyclotron
 * orbit or a projectile arc readable in a still screenshot.
 */
export function trail(
  ctx: CanvasRenderingContext2D,
  points: readonly Vec2[],
  options: { color?: string; width?: number; fade?: number } = {}
): void {
  const { color = INK.current, width = 2, fade = 0.85 } = options;
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 1; i < points.length; i += 1) {
    const age = i / (points.length - 1);
    ctx.globalAlpha = fade * age;
    ctx.beginPath();
    ctx.moveTo(points[i - 1].x, points[i - 1].y);
    ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }
  ctx.restore();
}

/* ── waves and beams ────────────────────────────────────────────────────── */

/**
 * A travelling sinusoid, y(x) = A sin(kx − ωt + φ).
 *
 * The caller supplies k and ω in the scene's own units, so the wave on screen
 * moves at a speed that means something rather than at a speed that looks nice.
 */
export function travellingWave(
  ctx: CanvasRenderingContext2D,
  options: {
    x0: number;
    x1: number;
    baseline: number;
    amplitude: number;
    k: number;
    omega: number;
    time: number;
    phase?: number;
    color?: string;
    width?: number;
    samples?: number;
    /** Envelope over the run, 0–1, for a damped or apodised beam. */
    envelope?: (fraction: number) => number;
  }
): void {
  const {
    x0, x1, baseline, amplitude, k, omega, time,
    phase = 0, color = INK.wave, width = 2, samples = 240, envelope
  } = options;
  if (!Number.isFinite(amplitude) || x1 <= x0) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i <= samples; i += 1) {
    const f = i / samples;
    const x = x0 + (x1 - x0) * f;
    const a = amplitude * (envelope ? envelope(f) : 1);
    const y = baseline - a * Math.sin(k * (x - x0) - omega * time + phase);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

/** Circular wavefronts spreading from a source — a crest every wavelength. */
export function wavefronts(
  ctx: CanvasRenderingContext2D,
  source: Vec2,
  options: {
    wavelength: number;
    speed: number;
    time: number;
    maxRadius: number;
    color?: string;
    alpha?: number;
  }
): void {
  const { wavelength, speed, time, maxRadius, color = INK.wave, alpha = 0.5 } = options;
  if (wavelength <= 0 || maxRadius <= 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  const travelled = (speed * time) % wavelength;
  for (let r = travelled; r < maxRadius; r += wavelength) {
    if (r < 1) continue;
    ctx.globalAlpha = alpha * (1 - r / maxRadius);
    ctx.beginPath();
    ctx.arc(source.x, source.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/* ── scene furniture ────────────────────────────────────────────────────── */

/** A faint reference grid, so a distance on screen can be judged by eye. */
export function grid(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; w: number; h: number },
  spacing = 40,
  color = INK.faint
): void {
  if (spacing <= 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = bounds.x; x <= bounds.x + bounds.w + 0.001; x += spacing) {
    ctx.moveTo(x, bounds.y);
    ctx.lineTo(x, bounds.y + bounds.h);
  }
  for (let y = bounds.y; y <= bounds.y + bounds.h + 0.001; y += spacing) {
    ctx.moveTo(bounds.x, y);
    ctx.lineTo(bounds.x + bounds.w, y);
  }
  ctx.stroke();
  ctx.restore();
}

/** A short caption on the stage — a scale bar's value, a field's magnitude. */
export function caption(
  ctx: CanvasRenderingContext2D,
  at: Vec2,
  text: string,
  options: { color?: string; size?: number; align?: CanvasTextAlign; mono?: boolean } = {}
): void {
  const { color = '#8497ad', size = 11, align = 'center', mono = false } = options;
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${size}px ${mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'ui-sans-serif, system-ui, sans-serif'}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, at.x, at.y);
  ctx.restore();
}

/**
 * The label a conceptual visualisation must carry.
 *
 * Any scene that animates charge flow, field lines or wavefronts is showing a
 * construct, not a photograph, and has to say so — the same rule the SVG
 * apparatus follows.
 */
export function disclosure(
  ctx: CanvasRenderingContext2D,
  text: string,
  bounds: { x: number; y: number; w: number; h: number }
): void {
  caption(ctx, { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h - 8 }, text, {
    color: '#5e7189',
    size: 9.5
  });
}

/** Clamps a value into 0–1 — the normalisation every field sample needs. */
export const unit = (v: number): number => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

/**
 * Compresses a wide dynamic range into 0–1 for display.
 *
 * An inverse-square field spans many orders of magnitude across one screen, so
 * a linear map leaves almost every arrow invisible. This is a display transform
 * and nothing else: the model's number is never altered, only how long the
 * arrow drawn for it is.
 */
export const compress = (value: number, scale: number): number => {
  if (!Number.isFinite(value) || scale <= 0) return 0;
  return unit(Math.log10(1 + Math.abs(value) / scale) / Math.log10(101));
};
