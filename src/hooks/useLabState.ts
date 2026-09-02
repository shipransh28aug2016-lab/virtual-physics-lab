import { useCallback, useMemo, useState } from 'react';
import type { ControlSpec, ExperimentDefinition, ParamValue, ParamValues } from '@/types/lab';

/** Initial parameter set: explicit defaults win, otherwise each control's own. */
export function initialParams(definition: ExperimentDefinition): ParamValues {
  const out: ParamValues = {};
  for (const c of definition.controls) out[c.key] = c.initial;
  return { ...out, ...definition.defaults };
}

export interface LabState {
  params: ParamValues;
  set: (key: string, value: ParamValue) => void;
  setMany: (values: ParamValues) => void;
  reset: () => void;
  /** Looks up a control spec by key, narrowed to the expected kind. */
  control: <K extends ControlSpec['kind']>(
    key: string,
    kind: K
  ) => Extract<ControlSpec, { kind: K }>;
  dirty: boolean;
}

/**
 * Owns the live parameters of one experiment. Updates are shallow and identity
 * stable, so `compute` memoisation only invalidates when a value really moves.
 */
export function useLabState(definition: ExperimentDefinition): LabState {
  const defaults = useMemo(() => initialParams(definition), [definition]);
  const [params, setParams] = useState<ParamValues>(defaults);

  const set = useCallback((key: string, value: ParamValue) => {
    setParams((p) => (p[key] === value ? p : { ...p, [key]: value }));
  }, []);

  const setMany = useCallback((values: ParamValues) => {
    setParams((p) => ({ ...p, ...values }));
  }, []);

  const reset = useCallback(() => setParams(defaults), [defaults]);

  const control = useCallback(
    <K extends ControlSpec['kind']>(key: string, kind: K) => {
      const found = definition.controls.find((c) => c.key === key);
      if (!found) {
        throw new Error(`${definition.slug}: no control named "${key}" in the definition.`);
      }
      if (found.kind !== kind) {
        throw new Error(
          `${definition.slug}: control "${key}" is a ${found.kind}, not a ${kind}.`
        );
      }
      return found as Extract<ControlSpec, { kind: K }>;
    },
    [definition]
  );

  const dirty = useMemo(
    () => Object.keys(defaults).some((k) => params[k] !== defaults[k]),
    [params, defaults]
  );

  return { params, set, setMany, reset, control, dirty };
}
