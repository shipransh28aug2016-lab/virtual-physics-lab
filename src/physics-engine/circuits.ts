import { celsiusToKelvin } from './units';
import { CONSTANTS } from './constants';

export interface Battery {
  emf: number;
  internalResistance: number;
}

export const seriesResistance = (values: number[]): number =>
  values.reduce((sum, r) => sum + r, 0);

/** Parallel combination; a single zero branch shorts the network. */
export function parallelResistance(values: number[]): number {
  if (values.length === 0) return 0;
  if (values.some((r) => r === 0)) return 0;
  const inv = values.reduce((s, r) => s + 1 / r, 0);
  return inv === 0 ? Number.POSITIVE_INFINITY : 1 / inv;
}

/** Current in a single loop: I = ε / (R_ext + r). */
export function loopCurrent(cell: Battery, externalResistance: number): number {
  const total = externalResistance + cell.internalResistance;
  if (total <= 0) return Number.POSITIVE_INFINITY;
  return cell.emf / total;
}

/** Terminal voltage under load: V = ε − I r. */
export const terminalVoltage = (cell: Battery, current: number): number =>
  cell.emf - current * cell.internalResistance;

/** Series combination: the emfs add and so do the internal resistances. */
export function cellsInSeries(cells: Battery[]): Battery {
  return {
    emf: cells.reduce((s, c) => s + c.emf, 0),
    internalResistance: cells.reduce((s, c) => s + c.internalResistance, 0)
  };
}

/**
 * Parallel combination. For identical cells the emf is unchanged and the
 * internal resistance falls as r/n; for unequal cells the standard
 * Thevenin reduction of the current sources is used.
 */
export function cellsInParallel(cells: Battery[]): Battery {
  if (cells.length === 0) return { emf: 0, internalResistance: 0 };
  if (cells.some((c) => c.internalResistance <= 0)) {
    return { emf: cells[0].emf, internalResistance: 0 };
  }
  const conductance = cells.reduce((s, c) => s + 1 / c.internalResistance, 0);
  const current = cells.reduce((s, c) => s + c.emf / c.internalResistance, 0);
  const internalResistance = 1 / conductance;
  return { emf: current * internalResistance, internalResistance };
}

/**
 * Metre-bridge balance point for an unknown R against a known resistance,
 * measured from the left end of a 1 m wire: R/S = l/(100 − l).
 */
export function metreBridgeBalanceLength(known: number, unknown: number): number {
  const sum = known + unknown;
  if (sum <= 0) return Number.NaN;
  return (100 * unknown) / sum;
}

/**
 * Resistance and resistivity of a wire from a metre-bridge balance length.
 * `balanceCm` is measured from the left gap; radius and length are in metres.
 */
export function resistivityFromMetreBridge(
  known: number,
  balanceCm: number,
  radiusM: number,
  lengthM: number
): { unknownResistance: number; resistivity: number } {
  const l = Math.min(Math.max(balanceCm, 1e-6), 100 - 1e-6);
  const unknownResistance = (known * l) / (100 - l);
  const area = Math.PI * radiusM * radiusM;
  const resistivity = lengthM > 0 ? (unknownResistance * area) / lengthM : Number.NaN;
  return { unknownResistance, resistivity };
}

/** ρ = RA/L for a uniform cylindrical conductor. */
export function resistivityFromWire(
  resistance: number,
  radiusM: number,
  lengthM: number
): number {
  if (lengthM <= 0 || radiusM <= 0) return Number.NaN;
  return (resistance * Math.PI * radiusM * radiusM) / lengthM;
}

/** R = ρL/A. */
export function wireResistance(resistivity: number, lengthM: number, radiusM: number): number {
  const area = Math.PI * radiusM * radiusM;
  return area > 0 ? (resistivity * lengthM) / area : Number.POSITIVE_INFINITY;
}

/** Linear temperature model R = R₀[1 + α(T − T₀)], clamped at zero. */
export const resistanceAtTemperature = (
  r0: number,
  alpha: number,
  tempC: number,
  refC = 20
): number => Math.max(r0 * (1 + alpha * (tempC - refC)), 0);

/**
 * Galvanometer resistance by half deflection: G = SR/(R − S), where R is the
 * series resistance and S the shunt that halves the deflection.
 */
export function galvanometerResistanceHalfDeflection(seriesR: number, shunt: number): number {
  const denom = seriesR - shunt;
  if (Math.abs(denom) < 1e-12) return Number.POSITIVE_INFINITY;
  return (shunt * seriesR) / denom;
}

/** Figure of merit k = ε / [(R + G)·n] in ampere per division. */
export function galvanometerFigureOfMerit(
  emf: number,
  totalResistance: number,
  divisions: number
): number {
  if (totalResistance <= 0 || divisions <= 0) return Number.NaN;
  return emf / (totalResistance * divisions);
}

/** Shunt that converts a galvanometer into an ammeter: S = I_g G/(I − I_g). */
export function ammeterShunt(g: number, ig: number, range: number): number {
  const denom = range - ig;
  if (denom <= 0) return Number.POSITIVE_INFINITY;
  return (ig * g) / denom;
}

/** Series multiplier for a voltmeter: R = V/I_g − G. */
export function voltmeterMultiplier(g: number, ig: number, range: number): number {
  if (ig <= 0) return Number.POSITIVE_INFINITY;
  return range / ig - g;
}

/** Potentiometer emf ratio ε₁/ε₂ = l₁/l₂. */
export const emfRatioFromPotentiometer = (l1: number, l2: number): number =>
  l2 === 0 ? Number.NaN : l1 / l2;

/** Internal resistance from a potentiometer: r = R(l₁ − l₂)/l₂. */
export function internalResistanceFromPotentiometer(
  l1: number,
  l2: number,
  shuntResistance: number
): number {
  if (l2 <= 0) return Number.NaN;
  return (shuntResistance * (l1 - l2)) / l2;
}

/** Shockley diode equation I = I_s(e^{V/(ηV_T)} − 1), η = 1 for the ideal case. */
export function diodeCurrent(
  saturationCurrent: number,
  voltage: number,
  temperatureK = 300,
  ideality = 1
): number {
  const vt = (CONSTANTS.K_B * Math.max(temperatureK, 1)) / CONSTANTS.E_CHARGE;
  const exponent = voltage / (ideality * vt);
  // Clamp so a forward sweep cannot overflow to Infinity in the view layer.
  if (exponent > 80) return saturationCurrent * Math.exp(80);
  return saturationCurrent * (Math.exp(exponent) - 1);
}

/** Thermal voltage kT/e at a Celsius temperature. */
export const thermalVoltage = (tempC: number): number =>
  (CONSTANTS.K_B * celsiusToKelvin(tempC)) / CONSTANTS.E_CHARGE;

/** Capacitor charging: V(t) = V₀(1 − e^{−t/RC}). */
export const rcCharge = (v0: number, r: number, c: number, t: number): number =>
  r * c <= 0 ? v0 : v0 * (1 - Math.exp(-t / (r * c)));

/** Capacitor discharging: V(t) = V₀e^{−t/RC}. */
export const rcDischarge = (v0: number, r: number, c: number, t: number): number =>
  r * c <= 0 ? 0 : v0 * Math.exp(-t / (r * c));

/** Inductor current growth: I(t) = I₀(1 − e^{−tR/L}). */
export const rlGrowth = (i0: number, r: number, l: number, t: number): number =>
  l <= 0 ? i0 : i0 * (1 - Math.exp((-t * r) / l));

/** Inductor current decay: I(t) = I₀e^{−tR/L}. */
export const rlDecay = (i0: number, r: number, l: number, t: number): number =>
  l <= 0 ? 0 : i0 * Math.exp((-t * r) / l);

/** Power dissipated in a resistance carrying a current, P = I²R. */
export const powerDissipated = (current: number, resistance: number): number =>
  current * current * resistance;

/** Power supplied by a source of emf, P = εI. */
export const powerSupplied = (emf: number, current: number): number => emf * current;
