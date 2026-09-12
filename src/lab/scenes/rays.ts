/**
 * The optical-ray scene.
 *
 * Sends light packets along exactly the ray paths the model constructed — the
 * same `BenchRay[]` the SVG bench draws — so the animation cannot disagree with
 * the diagram beneath it. Move the object and the packets take the new path on
 * the next frame, because the path is recomputed, not tweened.
 *
 * A ray diagram is a construction, not a photograph, and the packets travel at
 * a speed chosen for legibility. The scene says so: light covers the bench in
 * nanoseconds, and pretending otherwise would teach something false.
 */
import type { ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import type { BenchRay } from '@/components/instruments/OpticsBench';
import { INK, particle, unit, type Vec2 } from '@/lab/canvas/primitives';
import type { CanvasScene, SceneFrame } from '@/lab/canvas/scene';

export interface RaySceneOptions {
  /** The ray bundle for the current parameters — the model's own construction. */
  rays: (params: ParamValues, model: ModelOutput) => BenchRay[];
  label: CanvasScene['label'];
  width?: number;
  height?: number;
  /** Stage pixels a packet covers per second. */
  speed?: number;
  /** Stage pixels between successive packets on the same ray. */
  spacing?: number;
  enabled?: (params: ParamValues) => boolean;
  disclosure?: string;
}

const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t
});

const usable = (r: BenchRay): boolean =>
  [r.from.x, r.from.y, r.to.x, r.to.y].every(Number.isFinite) &&
  Math.hypot(r.to.x - r.from.x, r.to.y - r.from.y) > 2;

export function makeRayScene(options: RaySceneOptions): CanvasScene {
  const {
    rays: raysOf,
    label,
    width,
    height,
    speed = 210,
    spacing = 74,
    enabled,
    disclosure = 'Light packets are a visual construct at a readable speed — light itself crosses this bench in a few nanoseconds.'
  } = options;

  return {
    label,
    width,
    height,
    disclosure,
    draw({ ctx, params, model, time }: SceneFrame) {
      if (enabled && !enabled(params)) return;
      const rays = raysOf(params, model).filter(usable);
      if (rays.length === 0) return;

      // One phase drives every ray, so packets leaving the object stay in step
      // as they pass through the optic — which is what makes the construction
      // read as one wavefront rather than as unrelated dots.
      const phase = (time * speed) % spacing;

      for (const ray of rays) {
        const length = Math.hypot(ray.to.x - ray.from.x, ray.to.y - ray.from.y);
        // A virtual ray is where the light only appears to come from, so its
        // packets are dim: the diagram's dashes say the same thing.
        const virtual = ray.kind === 'virtual';
        const color = ray.color ?? (virtual ? INK.neutral : INK.ray);
        const alpha = virtual ? 0.3 : 0.9;
        const radius = virtual ? 1.8 : 2.6;

        for (let d = phase; d < length; d += spacing) {
          const t = d / length;
          const at = lerp(ray.from, ray.to, t);
          // Fade in at the start and out at the end so a packet never pops into
          // existence in the middle of the bench.
          const edge = Math.min(1, (t * length) / 18, ((1 - t) * length) / 18);
          particle(ctx, at, radius, color, alpha * unit(edge));
        }
      }
    }
  };
}
