import { useRef, type ReactNode } from 'react';
import type { ParamValues } from '@/types/lab';
import type { ModelOutput } from '@/components/shell/PhysicsExperiment';
import { CanvasStage } from './CanvasStage';
import { disclosure as drawDisclosure } from './primitives';

export const STAGE_W = 820;
export const STAGE_H = 470;

export interface SceneFrame {
  ctx: CanvasRenderingContext2D;
  /** Seconds since the scene mounted. */
  time: number;
  /** Seconds since the previous frame, already clamped by the render loop. */
  dt: number;
  /** The live control values — always this frame's, never a stale closure. */
  params: ParamValues;
  /** What `compute` returned for those values. The scene never re-derives it. */
  model: ModelOutput;
  width: number;
  height: number;
}

export interface CanvasScene {
  /** What a screen reader is told the canvas is showing, from the live model. */
  label: (params: ParamValues, model: ModelOutput) => string;
  /**
   * Logical size of the scene, which MUST match the viewBox of the SVG
   * apparatus it overlays — the two use the same "meet" letterboxing rule, so
   * matching sizes is what keeps a drawn arrow on top of the charge it belongs
   * to at every window width. Defaults to the common 820 × 470 stage.
   */
  width?: number;
  height?: number;
  /** Draws one frame in stage coordinates. */
  draw: (frame: SceneFrame) => void;
  /**
   * The honesty label a conceptual visualisation must carry — field lines,
   * charge-flow cues and wavefronts are constructs, not photographs. Drawn
   * along the bottom of the stage automatically when present.
   */
  disclosure?: string;
}

export interface SceneLayerProps {
  scene: CanvasScene;
  params: ParamValues;
  model: ModelOutput;
  /** Sits over the SVG apparatus rather than replacing it. */
  overlay?: boolean;
}

/**
 * Bridges React state into the render loop without letting the loop depend on
 * it.
 *
 * The live params and model are written into refs on every React render and
 * read back inside the frame callback, so a slider move is on screen in the
 * next frame — with no re-render of the canvas component, and no chance of the
 * scene drawing last render's numbers.
 */
export function SceneLayer({ scene, params, model, overlay = true }: SceneLayerProps) {
  const live = useRef({ params, model });
  live.current = { params, model };

  const width = scene.width ?? STAGE_W;
  const height = scene.height ?? STAGE_H;

  return (
    <CanvasStage
      width={width}
      height={height}
      overlay={overlay}
      label={scene.label(params, model)}
      draw={(ctx, frame) => {
        const { params: p, model: m } = live.current;
        scene.draw({
          ctx,
          time: frame.time,
          dt: frame.dt,
          params: p,
          model: m,
          width,
          height
        });
        if (scene.disclosure) {
          drawDisclosure(ctx, scene.disclosure, { x: 0, y: 0, w: width, h: height });
        }
      }}
    />
  );
}

/**
 * Keeps a bounded history of positions for a trail.
 *
 * A scene that wants a trajectory calls `push` once a frame; the buffer drops
 * its oldest point past `limit`, so a simulator left running for an hour uses
 * the same memory as one just opened.
 */
export class TrailBuffer {
  private points: { x: number; y: number }[] = [];
  constructor(private readonly limit = 160) {}

  push(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.points.push({ x, y });
    if (this.points.length > this.limit) this.points.shift();
  }

  clear(): void {
    this.points = [];
  }

  get all(): readonly { x: number; y: number }[] {
    return this.points;
  }

  get length(): number {
    return this.points.length;
  }
}

/** Convenience for a scene that only needs a static label. */
export const staticLabel =
  (text: string): CanvasScene['label'] =>
  () =>
    text;

export type SceneChildren = ReactNode;
