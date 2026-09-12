/**
 * The circuit-carrier scene.
 *
 * Charge carriers travel the bench's own leads at a speed taken from the solved
 * current in that branch, and reverse when the current does. Every number comes
 * from the modified-nodal-analysis solution the readouts are built from, so a
 * lead that the model says carries nothing shows nothing, and the branch with
 * the larger current visibly moves faster.
 *
 * It is a representation of **conventional current direction**, and the scene
 * says so. Electrons drift at something like 10⁻⁴ m/s; nothing on this screen
 * is travelling at a physical speed.
 */
import type { ParamValues } from '@/types/lab';
import {
  decodeWires,
  solveCircuit,
  terminal,
  type CircuitGraph
} from '@/physics-engine/circuit';
import { terminalPoint } from '@/components/bench/parts';
import { wireCurrent, wireLength, wirePoint } from '@/components/bench/geometry';
import { FLOW_DISCLOSURE } from '@/lab/motion';
import { INK, particle, unit, type Vec2 } from '@/lab/canvas/primitives';
import type { CanvasScene, SceneFrame } from '@/lab/canvas/scene';

export interface CircuitSceneOptions {
  /** Rebuilds the graph for the current parameters — the same one `compute` solves. */
  graph: (params: ParamValues) => CircuitGraph;
  label: CanvasScene['label'];
  width?: number;
  height?: number;
  /**
   * Stage pixels per second at one ampere. Carrier speed is proportional to the
   * current, so the ratio between two branches on screen is the ratio the model
   * computed — but the absolute scale is a display choice.
   */
  pxPerAmp?: number;
  /** Stage pixels between carriers on the same lead. */
  spacing?: number;
}

/** Below this the branch is simply not carrying anything worth drawing. */
const FLOOR = 1e-9;

export function makeCircuitScene(options: CircuitSceneOptions): CanvasScene {
  const { graph: graphOf, label, width, height, pxPerAmp = 260, spacing = 34 } = options;

  return {
    label,
    width,
    height,
    disclosure: FLOW_DISCLOSURE,
    draw({ ctx, params, time }: SceneFrame) {
      const graph = graphOf(params);
      const solution = solveCircuit(graph);
      const byId = new Map(graph.parts.map((p) => [p.id, p]));

      const at = new Map<string, Vec2>();
      for (const p of graph.parts) {
        at.set(terminal(p.id, 'a'), terminalPoint(p, 'a'));
        at.set(terminal(p.id, 'b'), terminalPoint(p, 'b'));
      }

      for (const wire of decodeWires(String(params.wiring ?? ''))) {
        const from = at.get(wire.from);
        const to = at.get(wire.to);
        if (!from || !to) continue;

        const current = wireCurrent(wire.from, wire.to, byId, solution);
        if (!Number.isFinite(current) || Math.abs(current) < FLOOR) continue;

        const length = wireLength(from, to);
        if (length < 4) continue;

        // Distance travelled so far, wrapped into one carrier spacing. The sign
        // of the current decides which way along the lead that is.
        const travelled = Math.abs(current) * pxPerAmp * time;
        const offset = travelled % spacing;
        const brightness = unit(Math.abs(current) / 0.5);

        for (let d = offset; d < length; d += spacing) {
          const t = current >= 0 ? d / length : 1 - d / length;
          particle(ctx, wirePoint(from, to, t), 2.4, INK.current, 0.45 + brightness * 0.5);
        }
      }
    }
  };
}
