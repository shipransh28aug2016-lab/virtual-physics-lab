/**
 * The axial magnetic-field scene.
 *
 * Markers travel along the axis of a coil or solenoid, and the speed of each is
 * the field strength **at its own position**, taken from the model's own
 * `B(x)`. That makes the uniform middle of a Helmholtz pair visibly uniform and
 * the fall-off past a solenoid's mouth visibly a fall-off: the markers bunch
 * where the field is weak and spread where it is strong, without a single
 * number being read.
 *
 * Field lines are a representation — Faraday's construct for a continuous
 * field — and nothing is travelling along a real one. The scene says so.
 */
import type { ParamValues } from '@/types/lab';
import { INK, particle, unit } from '@/lab/canvas/primitives';
import type { CanvasScene, SceneFrame } from '@/lab/canvas/scene';

export interface AxialFieldLayout {
  /** Stage x of the axis centre. */
  centreX: number;
  /** Stage y of the axis. */
  axisY: number;
  /** Stage pixels per metre along the axis. */
  pxPerMetre: number;
  /** Field on the axis at an axial position in metres, in tesla. */
  fieldAt: (xMetres: number) => number;
  /** How far along the axis, in metres, the markers run either side of centre. */
  span: number;
  /** Half-height of the bundle of lines drawn around the axis, in stage pixels. */
  spread?: number;
}

export interface AxialFieldSceneOptions {
  layout: (params: ParamValues) => AxialFieldLayout;
  label: CanvasScene['label'];
  width?: number;
  height?: number;
  enabled?: (params: ParamValues) => boolean;
  /** Marker rows above and below the axis. */
  lines?: number;
  disclosure?: string;
}

export function makeAxialFieldScene(options: AxialFieldSceneOptions): CanvasScene {
  const {
    layout: layoutOf,
    label,
    width,
    height,
    enabled,
    lines = 5,
    disclosure = 'Field lines are a representation of a continuous magnetic field — nothing travels along them. Marker speed follows the computed field strength at each point.'
  } = options;

  /** Markers, by axial position in metres, kept between frames. */
  let markers: { x: number; age: number; life: number }[] = [];
  let lastTime = Number.POSITIVE_INFINITY;

  /**
   * Respawns a marker at a random point on the axis.
   *
   * Not at "the other end": in an anti-Helmholtz pair the field points outward
   * on *both* sides of the centre, so a marker wrapped to the far end is
   * immediately ejected again and ping-pongs without ever travelling. A
   * uniform respawn plus a finite life is correct for any field topology,
   * including one with a null in the middle.
   */
  const spawn = (span: number) => ({
    x: (Math.random() * 2 - 1) * span,
    age: 0,
    life: 1.6 + Math.random() * 2.4
  });

  return {
    label,
    width,
    height,
    disclosure,
    draw({ ctx, params, time, dt }: SceneFrame) {
      if (enabled && !enabled(params)) return;
      const layout = layoutOf(params);
      const { centreX, axisY, pxPerMetre, span, spread = 46 } = layout;
      if (!(pxPerMetre > 0) || !(span > 0)) return;

      const perLine = 16;
      const want = lines * perLine;
      if (time < lastTime) markers = [];
      lastTime = time;
      while (markers.length < want) markers.push(spawn(span));
      if (markers.length > want) markers.length = want;

      // Normalise against the field at the centre, which is the value the
      // apparatus already reports, so "fast" means "as strong as the middle".
      const reference = Math.abs(layout.fieldAt(0)) || 1e-12;

      for (let i = 0; i < markers.length; i += 1) {
        const m = markers[i];
        const b = layout.fieldAt(m.x);
        const strength = unit(Math.abs(b) / reference);
        // Metres per second along the axis, from the local field. A reversed
        // field sends its marker the other way, which is exactly what the
        // opposed coil of an anti-Helmholtz pair should look like.
        const direction = b >= 0 ? 1 : -1;
        m.x += direction * (0.12 + strength * 0.55) * span * dt;
        m.age += dt;

        if (m.age > m.life || m.x > span || m.x < -span) {
          markers[i] = spawn(span);
          continue;
        }

        const row = i % lines;
        const offset = (row - (lines - 1) / 2) * (spread / Math.max(lines - 1, 1)) * 2;
        // Fade in and out so a marker never appears or vanishes abruptly.
        const fade = unit(Math.min(1, m.age / 0.3, (m.life - m.age) / 0.5));
        particle(
          ctx,
          { x: centreX + m.x * pxPerMetre, y: axisY + offset },
          1.8 + strength * 1.4,
          INK.field,
          (0.25 + strength * 0.6) * fade
        );
      }
    }
  };
}
