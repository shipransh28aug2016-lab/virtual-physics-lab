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

  const onRecord = useCallback(() => {
    if (!notebookSpec) return;
    book.record(notebookSpec.capture());
  }, [notebookSpec, book]);

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
      onRecord={onRecord}
      onRemoveRow={book.removeRow}
      onClearNotebook={book.clear}
    />
  );
}
