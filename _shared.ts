import type { GraphSpec, ObservationColumn, ParamValues } from '@/types/lab';
import { formatSI, formatFixed } from '@/utils/format';

/** Compact builder for a measurement readout. */
export const ro = (
  key: string,
  label: string,
  value: number,
  unit: string,
  precision = 3,
  extra?: { tone?: 'normal' | 'dim' | 'alert' | 'neg'; sub?: string; text?: string }
) => ({ key, label, value, unit, precision, ...extra });

/** Builds a single-series graph with an operating-point marker. */
export function singleSeriesGraph(spec: {
  title: string;
  xLabel: string;
  yLabel: string;
  seriesLabel: string;
  color?: string;
  points: { x: number; y: number }[];
  live?: { x: number; y: number };
  markers?: GraphSpec['markers'];
  guides?: GraphSpec['guides'];
  xFormat?: (v: number) => string;
  yFormat?: (v: number) => string;
}): GraphSpec {
  return {
    title: spec.title,
    xLabel: spec.xLabel,
    yLabel: spec.yLabel,
    series: [
      {
        key: 'main',
        label: spec.seriesLabel,
        color: spec.color ?? '#25d0ee',
        points: spec.points
      }
    ],
    markers: spec.markers ?? [],
    guides: spec.guides ?? [],
    xFormat: spec.xFormat,
    yFormat: spec.yFormat,
    live: spec.live
  };
}

/** Reads a numeric parameter safely, falling back when the value is unusable. */
export const num = (params: ParamValues, key: string, fallback = 0): number => {
  const v = Number(params[key]);
  return Number.isFinite(v) ? v : fallback;
};

export const bool = (params: ParamValues, key: string, fallback = false): boolean =>
  params[key] === undefined ? fallback : Boolean(params[key]);

export const str = (params: ParamValues, key: string, fallback = ''): string =>
  params[key] === undefined ? fallback : String(params[key]);

/** Formats a metre value as centimetres for display. */
export const mToCmText = (m: number): string => formatFixed(m * 100, 1);

/** Formats a value with an automatic metric prefix and unit. */
export const siText = (v: number, precision = 3): string => formatSI(v, precision);

/** A column definition shorthand for the notebook. */
export const col = (
  key: string,
  label: string,
  unit: string,
  precision = 3,
  derived = false
): ObservationColumn => ({ key, label, unit, precision, derived });
