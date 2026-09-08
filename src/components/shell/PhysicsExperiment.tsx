import { useCallback, useMemo, type ReactNode } from 'react';
import type {
  EducationPack,
  ExperimentDefinition,
  GraphSpec,
  NotebookSpec,
  ParamValues,
  Readout,
  ValidationIssue
} from '@/types/lab';
import type { StageApi } from '@/components/controls/StageKit';
import type { ObservationRow } from '@/types/lab';
import { useLabState } from '@/hooks/useLabState';
import { useNotebook } from '@/hooks/useNotebook';
import { SimulatorShell } from '@/components/shell/SimulatorShell';

/** Everything `compute` gives back. The view never invents any of it. */
export interface ModelOutput {
  readouts: Readout[];
  graph: GraphSpec;
  /** Operating point highlighted on the graph; `null` when undefined. */
  live?: { x: number; y: number } | null;
  description: string;
  result: string;
  issues?: ValidationIssue[];
}

export interface PhysicsExperimentProps {
  definition: ExperimentDefinition;
  education: EducationPack;
  compute: (params: ParamValues) => ModelOutput;
  renderStage: (api: StageApi) => ReactNode;
  notebook?: (ctx: {
    params: ParamValues;
    model: ModelOutput;
    rows: ObservationRow[];
  }) => NotebookSpec;
  viewportOverlay?: (params: ParamValues, model: ModelOutput) => ReactNode;
}

/**
 * Wires one experiment together: parameter state, the memoised physics model,
 * the notebook, and the chrome. Every simulator's default export is this
 * component with its own definition/compute/stage supplied.
 */
export function PhysicsExperiment({
  definition,
  education,
  compute,
  renderStage,
  notebook,
  viewportOverlay
}: PhysicsExperimentProps) {
  const lab = useLabState(definition);
  const book = useNotebook(definition.slug);

  // The model is recomputed only when a parameter actually changes.
  const model = useMemo(() => compute(lab.params), [compute, lab.params]);

  const stageApi = useMemo<StageApi>(
    () => ({ params: lab.params, set: lab.set, control: lab.control }),
    [lab.params, lab.set, lab.control]
  );

  const notebookSpec = useMemo(
    () => notebook?.({ params: lab.params, model, rows: book.rows }),
    [notebook, lab.params, model, book.rows]
  );

  /**
   * A trial records what the apparatus was set to as well as what it read, so
   * a row in the exported table can be traced back to the settings that
   * produced it. The snapshot is built from the controls the experiment
   * declares, so no experiment has to remember to provide one.
   */
  const settingsSnapshot = useCallback(
    () =>
      definition.controls
        .filter((c) => c.kind === 'slider' || c.kind === 'toggle' || c.kind === 'select' || c.kind === 'segmented')
        .map((c) => {
          const v = lab.params[c.key];
          const shown = typeof v === 'number' ? Number(v.toFixed(4)) : v;
          // A netlist is long and is not a setting a student reads back.
          if (typeof shown === 'string' && shown.length > 24) return null;
          const unit = 'unit' in c && c.unit ? ` ${c.unit}` : '';
          return `${c.label} ${shown}${unit}`;
        })
        .filter((x): x is string => x !== null)
        .join('; '),
    [definition.controls, lab.params]
  );

  const onRecord = useCallback(() => {
    if (!notebookSpec) return;
    book.record(notebookSpec.capture(), settingsSnapshot());
  }, [notebookSpec, book, settingsSnapshot]);

  return (
    <SimulatorShell
      definition={definition}
      education={education}
      model={model}
      lab={lab}
      stage={renderStage(stageApi)}
      overlay={viewportOverlay?.(lab.params, model)}
      notebookSpec={notebookSpec}
      notebookRows={book.rows}
      notebookConclusion={book.conclusion}
      onRecord={onRecord}
      onRemoveRow={book.removeRow}
      onAnnotateRow={book.annotate}
      onConclusion={book.setConclusion}
      onClearNotebook={book.clear}
    />
  );
}
