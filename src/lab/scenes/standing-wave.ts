/**
 * The standing-wave scene.
 *
 * Draws a stretched string in its own normal mode,
 *
 *     y(x, t) = A sin(nπx / L) cos(2π f t),
 *
 * with the amplitude, the mode number and the frequency all taken from the
 * model. At resonance the string swings through its full envelope; off
 * resonance it barely moves, which is the whole point of the experiment.
 *
 * A sonometer wire driven from the mains vibrates at about a hundred hertz —
 * far past what sixty frames a second can show. The scene therefore runs a
 * slowed clock and states the real frequency and the slowdown factor, rather
 * than drawing a blur and letting a student believe they are seeing the wire.
 */
import type { ParamValues } from '@/types/lab';
import { INK, caption, unit } from '@/lab/canvas/primitives';
import type { CanvasScene, SceneFrame } from '@/lab/canvas/scene';

export interface StandingWaveLayout {
  /** Stage x where the vibrating span begins. */
  x0: number;
  /** Stage x where it ends. */
  x1: number;
  /** Stage y of the string at rest. */
  y: number;
  /** Peak displacement in stage pixels — 0 when the string is not resonating. */
  amplitude: number;
  /** True vibration frequency in hertz, for the caption. */
  frequency: number;
  /** Harmonic number: 1 is the fundamental, one loop between the bridges. */
  mode?: number;
}

export interface StandingWaveSceneOptions {
  layout: (params: ParamValues) => StandingWaveLayout;
  label: CanvasScene['label'];
  width?: number;
  height?: number;
  /** Cycles per second on screen. Kept low enough for the eye to follow. */
  displayHz?: number;
  enabled?: (params: ParamValues) => boolean;
}

export function makeStandingWaveScene(options: StandingWaveSceneOptions): CanvasScene {
  const { layout: layoutOf, label, width, height, displayHz = 1.1, enabled } = options;

  return {
    label,
    width,
    height,
    // Filled in per frame with the real frequency, since the honest statement
    // depends on how far the animation has been slowed.
    disclosure: 'The string is drawn in slow motion — it vibrates far faster than a screen can show.',
    draw({ ctx, params, time }: SceneFrame) {
      if (enabled && !enabled(params)) return;
      const { x0, x1, y, amplitude, frequency, mode = 1 } = layoutOf(params);
      const span = x1 - x0;
      if (!(span > 4) || !Number.isFinite(amplitude)) return;

      const phase = Math.cos(2 * Math.PI * displayHz * time);
      const samples = Math.max(40, Math.min(280, Math.round(span / 3)));

      // The envelope: where the string reaches at the extremes of its swing.
      // Drawing it as well as the instantaneous shape is what makes a node a
      // node to the eye rather than just a point that happens to be still.
      for (const sign of [1, -1]) {
        ctx.save();
        ctx.strokeStyle = INK.current;
        ctx.globalAlpha = 0.22;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i <= samples; i += 1) {
          const f = i / samples;
          const yy = y - sign * amplitude * Math.sin(mode * Math.PI * f);
          if (i === 0) ctx.moveTo(x0, yy);
          else ctx.lineTo(x0 + span * f, yy);
        }
        ctx.stroke();
        ctx.restore();
      }

      // The string itself, at this instant.
      ctx.save();
      ctx.strokeStyle = INK.current;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.5 + unit(Math.abs(amplitude) / 24) * 0.5;
      ctx.beginPath();
      for (let i = 0; i <= samples; i += 1) {
        const f = i / samples;
        const yy = y - amplitude * phase * Math.sin(mode * Math.PI * f);
        if (i === 0) ctx.moveTo(x0, yy);
        else ctx.lineTo(x0 + span * f, yy);
      }
      ctx.stroke();
      ctx.restore();

      if (amplitude > 0.5 && Number.isFinite(frequency) && frequency > 0) {
        const slowdown = Math.round(frequency / displayHz);
        caption(
          ctx,
          { x: (x0 + x1) / 2, y: y - amplitude - 16 },
          `${frequency.toFixed(1)} Hz — shown about ${slowdown.toLocaleString()}× slower`,
          { color: INK.hot, size: 10.5, mono: true }
        );
      }
    }
  };
}
