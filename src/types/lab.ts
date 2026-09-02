/**
 * Core vocabulary shared by the physics engine, the simulator shell and every
 * experiment module. Everything here is view-agnostic: an experiment describes
 * *what* it measures, never *how* it is drawn.
 */

export type UnitSlug =
  | 'electrostatics'
  | 'current-electricity'
  | 'magnetism'
  | 'emi-ac'
  | 'optics'
  | 'dual-nature'
  | 'modern-physics'
  | 'chemistry'
  | 'practical-a'
  | 'practical-b';

export type ExperimentKind = 'practical' | 'activity' | 'theory';
export type Difficulty = 'easy' | 'moderate' | 'advanced';

/** A live parameter set. Values are primitives so state stays serialisable. */
export type ParamValue = number | boolean | string;
export type ParamValues = Record<string, ParamValue>;

export interface SelectOption {
  value: string;
  label: string;
}

interface ControlBase {
  key: string;
  label: string;
  /** TeX symbol shown beside the label. */
  symbol?: string;
  unit?: string;
  hint?: string;
  /** Render the handle on the apparatus rather than in the control dock. */
  onStage?: boolean;
  /** Explicit on-apparatus placement for slider tracks drawn by the stage. */
  stage?: { x: number; y: number; length: number };
  /** Greys the control out when the predicate holds for the current params. */
  disabledIf?: (params: ParamValues) => boolean;
}

export interface SliderControl extends ControlBase {
  kind: 'slider';
  min: number;
  max: number;
  step: number;
  initial: number;
  precision?: number;
  /** 'log' spreads a wide range evenly across the travel of the handle. */
  scale?: 'linear' | 'log';
}

export interface ToggleControl extends ControlBase {
  kind: 'toggle';
  initial: boolean;
}

export interface SelectControl extends ControlBase {
  kind: 'select';
  initial: string;
  options: SelectOption[];
}

/** A select rendered as a row of buttons — for two or three exclusive modes. */
export interface SegmentedControl extends ControlBase {
  kind: 'segmented';
  initial: string;
  options: SelectOption[];
}

export type ControlSpec =
  | SliderControl
  | ToggleControl
  | SelectControl
  | SegmentedControl;
export type ControlKind = ControlSpec['kind'];

export interface ExperimentDefinition {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  aim: string;
  unit: UnitSlug;
  chapter: string;
  kind: ExperimentKind;
  difficulty: Difficulty;
  /** CBSE practical number, e.g. "A1" or "B6". Absent for theory simulators. */
  practicalNo?: string;
  thumbLabel: string;
  accent: string;
  controls: ControlSpec[];
  defaults: ParamValues;
}

/* ── Education pack ─────────────────────────────────────────────────────── */

export interface Formula {
  tex: string;
  caption?: string;
}

export interface VariableNote {
  symbol: string;
  name: string;
  unit: string;
  note?: string;
}

export interface VivaItem {
  q: string;
  a: string;
}

export interface EducationPack {
  theory: string[];
  formulas: Formula[];
  variables: VariableNote[];
  procedure: string[];
  precautions: string[];
  sourcesOfError?: string[];
  tips?: string[];
  viva: VivaItem[];
  resultTemplate: string;
}

/* ── Validation ─────────────────────────────────────────────────────────── */

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  field: string;
  severity: IssueSeverity;
  message: string;
}

/* ── Measurements & graphs ──────────────────────────────────────────────── */

export type ReadoutTone = 'normal' | 'dim' | 'alert' | 'neg';

export interface Readout {
  key: string;
  label: string;
  value: number;
  unit: string;
  precision?: number;
  tone?: ReadoutTone;
  sub?: string;
  /** Overrides the formatted number when a reading is not purely numeric. */
  text?: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface GraphSeries {
  key: string;
  label: string;
  color: string;
  points: Point[];
  dashed?: boolean;
}

export interface GraphMarker extends Point {
  label?: string;
  color?: string;
}

export interface GraphGuide {
  axis: 'x' | 'y';
  value: number;
  label?: string;
  color?: string;
}

export interface GraphSpec {
  title: string;
  xLabel: string;
  yLabel: string;
  series: GraphSeries[];
  markers?: GraphMarker[];
  guides?: GraphGuide[];
  xFormat?: (v: number) => string;
  yFormat?: (v: number) => string;
  /** The operating point for the current parameter set. */
  live?: Point;
}

/* ── Lab notebook ───────────────────────────────────────────────────────── */

export interface ObservationColumn {
  key: string;
  label: string;
  unit: string;
  precision?: number;
  /** Derived columns are computed from the captured row, never measured. */
  derived?: boolean;
}

export type ObservationRow = Record<string, number | string>;

export interface NotebookComparison {
  label: string;
  unit: string;
  experimental: number;
  theoretical: number;
  precision?: number;
}

export interface NotebookFootNote {
  label: string;
  value: string;
}

export interface NotebookSpec {
  title: string;
  columns: ObservationColumn[];
  capture: () => ObservationRow;
  derive?: (row: ObservationRow) => ObservationRow;
  comparison?: NotebookComparison;
  captureHint?: string;
  captureEnabled?: boolean;
  extraFoot?: NotebookFootNote[];
}
