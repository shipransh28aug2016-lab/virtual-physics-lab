/**
 * The electrostatic field scene.
 *
 * Draws the field of an arbitrary set of point charges by **superposition** —
 * every sample is Σ kqᵣ̂/r² over the real charges, in SI units, at a real
 * distance derived from the stage's own scale. Nothing here is a decorative
 * swirl: move a charge and every arrow on the screen changes because the sum
 * changed.
 *
 * Two layers, both driven by that one field:
 *
 *   · a fixed grid of arrows, whose length is a compressed measure of |E| and
 *     whose direction is exactly the field direction at that point;
 *   · tracers that drift along the field at a speed proportional to |E|, which
 *     is what turns a static diagram into something a student can watch.
 *
 * The tracers are a construct and the scene says so. A field is continuous and
 * time-independent; nothing physical is travelling along it.
 */
import { CONSTANTS } from '@/physics-engine/constants';
import type { ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { compress, fieldArrow, INK, particle, unit, type Vec2 } from '@/lab/canvas/primitives';
import type { CanvasScene, SceneFrame } from '@/lab/canvas/scene';

export interface PointCharge {
  /** Stage x, in the same 820 × 470 space the SVG apparatus uses. */
  x: number;
  /** Stage y. */
  y: number;
  /** Charge in coulombs. */
  q: number;
}

export interface FieldLayout {
  charges: PointCharge[];
  /** Stage pixels per metre — how the drawing's distances map to real ones. */
  pxPerMetre: number;
  /** Relative permittivity of the medium the charges sit in. */
  kappa?: number;
  /** Region of the stage the field is drawn over. */
  bounds?: { x: number; y: number; w: number; h: number };
}

export interface FieldSceneOptions {
  layout: (params: ParamValues, model: ModelOutput) => FieldLayout;
  label: CanvasScene['label'];
  /** Must match the viewBox of the SVG apparatus this overlays. */
  width?: number;
  height?: number;
  /** Grid pitch for the arrow samples, in stage pixels. */
  pitch?: number;
  /** How many tracers drift along the field. */
  tracers?: number;
  /** Lets an experiment's own "show field" control switch the layer off. */
  enabled?: (params: ParamValues) => boolean;
  /**
   * Draw the grid of sample arrows. Turn it off where the apparatus already
   * draws field *lines*: streamlines and a sampled arrow grid are two
   * representations of the same field, and showing both at once is clutter
   * rather than information. The tracers still run, which is the motion the
   * static diagram was missing.
   */
  arrows?: boolean;
  disclosure?: string;
}

const DEFAULT_BOUNDS = { x: 40, y: 60, w: 740, h: 330 };

/**
 * Electric field at a stage point, in volts per metre.
 *
 * E = (1/κ) Σ k qᵢ (r − rᵢ) / |r − rᵢ|³, evaluated in metres. The near-field
 * singularity is handled by a floor on r: inside the drawn radius of a charge
 * the field is not shown at all, so the floor never reaches the screen — it
 * only keeps the arithmetic finite.
 */
export function fieldAt(point: Vec2, layout: FieldLayout): Vec2 {
  const { charges, pxPerMetre, kappa = 1 } = layout;
  if (pxPerMetre <= 0) return { x: 0, y: 0 };
  let ex = 0;
  let ey = 0;
  for (const c of charges) {
    const dxPx = point.x - c.x;
    const dyPx = point.y - c.y;
    const rPx = Math.hypot(dxPx, dyPx);
    if (rPx < 1e-6) continue;
    const rM = Math.max(rPx / pxPerMetre, 1e-6);
    const magnitude = (CONSTANTS.K_E * c.q) / (kappa * rM * rM);
    ex += (magnitude * dxPx) / rPx;
    ey += (magnitude * dyPx) / rPx;
  }
  return { x: ex, y: ey };
}

/** True inside a charge's drawn glyph, where an arrow would be meaningless. */
const insideACharge = (p: Vec2, layout: FieldLayout, radius = 26): boolean =>
  layout.charges.some((c) => Math.hypot(p.x - c.x, p.y - c.y) < radius);

interface Tracer {
  x: number;
  y: number;
  /** Seconds lived; a tracer is retired and respawned so the flow never freezes. */
  age: number;
  life: number;
}

export function makeFieldScene(options: FieldSceneOptions): CanvasScene {
  const {
    layout: layoutOf,
    label,
    width,
    height,
    pitch = 46,
    tracers: tracerCount = 130,
    enabled,
    arrows = true,
    disclosure
  } = options;
  // The honesty label has to describe what is actually on the screen, so it
  // follows whether the arrow grid is drawn.
  const honesty =
    disclosure ??
    (arrows
      ? 'Field arrows and drifting markers are a visual construct — the field itself is continuous and does not flow.'
      : 'The drifting markers are a visual construct — the field itself is continuous and static; nothing travels along it.');

  let tracers: Tracer[] = [];
  let lastTime = Number.POSITIVE_INFINITY;

  const spawn = (bounds: { x: number; y: number; w: number; h: number }): Tracer => ({
    x: bounds.x + Math.random() * bounds.w,
    y: bounds.y + Math.random() * bounds.h,
    age: 0,
    life: 1.4 + Math.random() * 2.2
  });

  return {
    label,
    width,
    height,
    disclosure: honesty,
    draw({ ctx, params, model, time, dt }: SceneFrame) {
      if (enabled && !enabled(params)) {
        tracers = [];
        return;
      }
      const layout = layoutOf(params, model);
      const bounds = layout.bounds ?? DEFAULT_BOUNDS;
      if (layout.charges.length === 0 || layout.pxPerMetre <= 0) return;

      // A remount restarts the clock; drop stale tracers rather than letting
      // the previous experiment's flow bleed into this one.
      if (time < lastTime) tracers = [];
      lastTime = time;
      while (tracers.length < tracerCount) tracers.push(spawn(bounds));
      if (tracers.length > tracerCount) tracers.length = tracerCount;

      // Scale: the strongest sample on the grid sets what "a long arrow" means,
      // so the picture stays readable whether the charges are nano- or
      // microcoulombs. It is a display choice and changes no number.
      let peak = 0;
      const samples: { at: Vec2; angle: number; magnitude: number }[] = [];
      for (let x = bounds.x + pitch / 2; x < bounds.x + bounds.w; x += pitch) {
        for (let y = bounds.y + pitch / 2; y < bounds.y + bounds.h; y += pitch) {
          const at = { x, y };
          if (insideACharge(at, layout)) continue;
          const e = fieldAt(at, layout);
          const magnitude = Math.hypot(e.x, e.y);
          if (!Number.isFinite(magnitude) || magnitude === 0) continue;
          peak = Math.max(peak, magnitude);
          samples.push({ at, angle: Math.atan2(e.y, e.x), magnitude });
        }
      }
      if (peak <= 0) return;

      if (arrows) {
        for (const s of samples) {
          fieldArrow(ctx, s.at, s.angle, compress(s.magnitude, peak / 60), {
            color: INK.field,
            maxLength: pitch * 0.78
          });
        }
      }

      /* ── tracers ──────────────────────────────────────────────────────── */
      // Drift speed is proportional to |E|/peak, so a tracer visibly hurries
      // where the field is strong and loiters where it is weak.
      const travel = pitch * 5;
      for (const t of tracers) {
        const e = fieldAt({ x: t.x, y: t.y }, layout);
        const magnitude = Math.hypot(e.x, e.y);
        const speed = unit(magnitude / peak) * travel;
        if (magnitude > 0) {
          t.x += (e.x / magnitude) * speed * dt;
          t.y += (e.y / magnitude) * speed * dt;
        }
        t.age += dt;

        const gone =
          t.age > t.life ||
          t.x < bounds.x ||
          t.x > bounds.x + bounds.w ||
          t.y < bounds.y ||
          t.y > bounds.y + bounds.h ||
          insideACharge({ x: t.x, y: t.y }, layout, 16);
        if (gone) {
          const fresh = spawn(bounds);
          t.x = fresh.x;
          t.y = fresh.y;
          t.age = 0;
          t.life = fresh.life;
          continue;
        }

        // Fade in and out so a tracer never appears or vanishes abruptly.
        const fade = Math.min(1, t.age / 0.35, (t.life - t.age) / 0.5);
        particle(ctx, { x: t.x, y: t.y }, 2.2, INK.field, unit(fade) * 0.85);
      }
    }
  };
}
