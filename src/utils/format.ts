const SI_PREFIXES: { exp: number; symbol: string }[] = [
  { exp: 12, symbol: 'T' },
  { exp: 9, symbol: 'G' },
  { exp: 6, symbol: 'M' },
  { exp: 3, symbol: 'k' },
  { exp: 0, symbol: '' },
  { exp: -3, symbol: 'm' },
  { exp: -6, symbol: 'µ' },
  { exp: -9, symbol: 'n' },
  { exp: -12, symbol: 'p' },
  { exp: -15, symbol: 'f' }
];

/** Fixed-point text that never renders "NaN" or "-0". */
export function formatFixed(value: number, precision = 2): string {
  if (!Number.isFinite(value)) return '—';
  const out = value.toFixed(precision);
  return out === (0).toFixed(precision).replace(/^0/, '-0') ? (0).toFixed(precision) : out;
}

/**
 * Formats a magnitude with an automatic metric prefix, e.g. 0.00042 → "420 µ".
 * The prefix is part of the returned string so callers append the bare unit.
 */
export function formatSI(value: number, significant = 3): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1e15 || abs < 1e-15) return value.toExponential(Math.max(significant - 1, 0));

  const chosen =
    SI_PREFIXES.find((p) => abs >= 10 ** p.exp) ?? SI_PREFIXES[SI_PREFIXES.length - 1];
  const scaled = value / 10 ** chosen.exp;
  const digits = Math.max(0, significant - 1 - Math.floor(Math.log10(Math.abs(scaled))));
  return `${Number(scaled.toFixed(Math.min(digits, 6)))}${chosen.symbol}`;
}

/** Percentage difference between an experimental and a theoretical value. */
export function percentError(experimental: number, theoretical: number): number {
  if (!Number.isFinite(experimental) || !Number.isFinite(theoretical) || theoretical === 0) {
    return Number.NaN;
  }
  return ((experimental - theoretical) / Math.abs(theoretical)) * 100;
}

/** Clamps a value into [min, max], tolerating reversed bounds. */
export const clamp = (v: number, min: number, max: number): number =>
  Math.min(Math.max(v, Math.min(min, max)), Math.max(min, max));
