import { CONSTANTS } from './constants';
import { degToRad } from './units';

/** Lorentz force magnitude F = qvB sinθ (N), θ in degrees. */
export const lorentzForce = (
  charge: number,
  speed: number,
  field: number,
  angleDeg = 90
): number => Math.abs(charge) * speed * field * Math.sin(degToRad(angleDeg));

/** Force on a current-carrying conductor F = BIL sinθ (N), θ in degrees. */
export const forceOnWire = (
  field: number,
  current: number,
  lengthM: number,
  angleDeg = 90
): number => field * current * lengthM * Math.sin(degToRad(angleDeg));

/** Radius of the circular path of a charged particle, r = mv/(qB) (m). */
export function gyroradius(mass: number, speed: number, charge: number, field: number): number {
  const denom = Math.abs(charge) * field;
  if (denom <= 0) return Number.POSITIVE_INFINITY;
  return (mass * speed) / denom;
}

/** Cyclotron frequency f = qB/(2πm) (Hz) — independent of speed and radius. */
export function cyclotronFrequency(charge: number, field: number, mass: number): number {
  if (mass <= 0) return Number.NaN;
  return (Math.abs(charge) * field) / (2 * Math.PI * mass);
}

/** Maximum kinetic energy from a cyclotron of dee radius R: q²B²R²/(2m) (J). */
export function cyclotronMaxEnergy(
  charge: number,
  field: number,
  deeRadiusM: number,
  mass: number
): number {
  if (mass <= 0) return Number.NaN;
  return (charge * charge * field * field * deeRadiusM * deeRadiusM) / (2 * mass);
}

/** Field inside a long solenoid B = µ₀nI (T), n in turns per metre. */
export const idealSolenoidField = (current: number, turnsPerMetre: number): number =>
  CONSTANTS.MU_0 * turnsPerMetre * current;

/** On-axis field of a circular coil at distance x from its centre (T). */
export function coilAxialField(
  current: number,
  radiusM: number,
  turns: number,
  axialDistanceM: number
): number {
  const denom = 2 * Math.pow(radiusM * radiusM + axialDistanceM * axialDistanceM, 1.5);
  if (denom <= 0) return 0;
  return (CONSTANTS.MU_0 * turns * current * radiusM * radiusM) / denom;
}

/** Field of a long straight conductor at distance r, B = µ₀I/(2πr) (T). */
export function straightWireField(current: number, distanceM: number): number {
  if (distanceM <= 0) return Number.POSITIVE_INFINITY;
  return (CONSTANTS.MU_0 * current) / (2 * Math.PI * distanceM);
}

/** Magnetic flux Φ = NBA cosθ (Wb), θ in degrees. */
export const magneticFlux = (
  field: number,
  areaM2: number,
  turns = 1,
  angleDeg = 0
): number => turns * field * areaM2 * Math.cos(degToRad(angleDeg));

/** Faraday's law: ε = −dΦ/dt. `fluxRate` is already dΦ/dt in Wb/s. */
export const inducedEmf = (fluxRate: number, turns = 1): number => -turns * fluxRate;

/** Torque on a current loop τ = NBIA sinθ (N m), θ in degrees. */
export const loopTorque = (
  turns: number,
  field: number,
  current: number,
  areaM2: number,
  angleDeg = 90
): number => turns * field * current * areaM2 * Math.sin(degToRad(angleDeg));

/** Magnetic moment of a current loop, m = NIA (A m²). */
export const magneticMoment = (turns: number, current: number, areaM2: number): number =>
  turns * current * areaM2;
