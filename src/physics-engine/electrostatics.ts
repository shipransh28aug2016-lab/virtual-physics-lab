import { CONSTANTS } from './constants';
import type { Vec2 } from './vectors';

export interface PointCharge {
  /** Charge in coulomb. */
  q: number;
  /** Position in metre. */
  pos: Vec2;
}

/** Coulomb force magnitude-with-sign between two charges (N). Positive = repulsive. */
export function coulombForce(q1: number, q2: number, separationM: number): number {
  if (separationM <= 0) return Number.POSITIVE_INFINITY;
  return (CONSTANTS.K_E * q1 * q2) / (separationM * separationM);
}

/** Field of a point charge at distance r (N/C), signed by the charge. */
export function electricFieldPointCharge(q: number, rM: number): number {
  if (rM <= 0) return Number.POSITIVE_INFINITY;
  return (CONSTANTS.K_E * q) / (rM * rM);
}

/** Potential of a point charge at distance r (V), signed by the charge. */
export function potentialPointCharge(q: number, rM: number): number {
  if (rM <= 0) return Number.POSITIVE_INFINITY;
  return (CONSTANTS.K_E * q) / rM;
}

/** Electrostatic potential energy of a pair (J). */
export function potentialEnergyPair(q1: number, q2: number, rM: number): number {
  if (rM <= 0) return Number.POSITIVE_INFINITY;
  return (CONSTANTS.K_E * q1 * q2) / rM;
}

/**
 * Vector sum of the fields of several point charges at a probe point.
 * Coordinates are metres; the result is in N/C.
 */
export function electricFieldSuperposition(charges: PointCharge[], at: Vec2): Vec2 {
  let ex = 0;
  let ey = 0;
  for (const c of charges) {
    const dx = at.x - c.pos.x;
    const dy = at.y - c.pos.y;
    const r2 = dx * dx + dy * dy;
    if (r2 < 1e-24) continue; // sitting on the charge: the field is undefined
    const r = Math.sqrt(r2);
    const e = (CONSTANTS.K_E * c.q) / r2;
    ex += (e * dx) / r;
    ey += (e * dy) / r;
  }
  return { x: ex, y: ey };
}

/** Net potential of several point charges at a probe point (V). */
export function potentialSuperposition(charges: PointCharge[], at: Vec2): number {
  return charges.reduce((sum, c) => {
    const r = Math.hypot(at.x - c.pos.x, at.y - c.pos.y);
    return r < 1e-12 ? sum : sum + (CONSTANTS.K_E * c.q) / r;
  }, 0);
}

export interface CapacitorSpec {
  /** Plate area in m². */
  area: number;
  /** Plate separation in m. */
  separation: number;
  /** Relative permittivity of the dielectric. */
  kappa: number;
  /** Applied potential difference in V. */
  voltage: number;
}

export interface CapacitorResult {
  capacitance: number;
  charge: number;
  field: number;
  energy: number;
  energyDensity: number;
  surfaceChargeDensity: number;
  meta: { epsilon: number; area: number; separation: number; kappa: number };
}

/** Ideal parallel-plate capacitor with a uniform dielectric. */
export function parallelPlateCapacitor(spec: CapacitorSpec): CapacitorResult {
  const { area, separation, kappa, voltage } = spec;
  const epsilon = CONSTANTS.EPSILON_0 * kappa;
  const capacitance = separation > 0 ? (epsilon * area) / separation : Number.POSITIVE_INFINITY;
  const charge = capacitance * voltage;
  const field = separation > 0 ? voltage / separation : Number.POSITIVE_INFINITY;
  const energy = 0.5 * capacitance * voltage * voltage;
  const energyDensity = 0.5 * epsilon * field * field;
  const surfaceChargeDensity = area > 0 ? charge / area : Number.NaN;
  return {
    capacitance,
    charge,
    field,
    energy,
    energyDensity,
    surfaceChargeDensity,
    meta: { epsilon, area, separation, kappa }
  };
}

/** Skin depth δ = √(2/(ωµσ)) for a good conductor (m). */
export function skinDepth(frequencyHz: number, conductivity: number, muR = 1): number {
  const omega = 2 * Math.PI * frequencyHz;
  const mu = CONSTANTS.MU_0 * muR;
  if (omega <= 0 || conductivity <= 0) return Number.POSITIVE_INFINITY;
  return Math.sqrt(2 / (omega * mu * conductivity));
}

/**
 * Fractional field leaking into a meshed Faraday cage.
 *
 * Two mechanisms compete: attenuation through the metal itself (governed by the
 * skin depth) and diffraction through the apertures, which only becomes
 * significant as the hole size approaches half a wavelength. The returned value
 * is E_inside / E_outside, clamped to (0, 1].
 */
export function cageShielding(
  frequencyHz: number,
  conductivity: number,
  thicknessM: number,
  holeSizeM: number
): number {
  const delta = skinDepth(frequencyHz, conductivity);
  const throughMetal = Number.isFinite(delta) && delta > 0 ? Math.exp(-thicknessM / delta) : 1;
  const wavelength = frequencyHz > 0 ? CONSTANTS.C_LIGHT / frequencyHz : Number.POSITIVE_INFINITY;
  // Below the aperture cut-off (λ/2) the holes are evanescent; above it they pass.
  const cutOff = wavelength / 2;
  const throughHoles =
    holeSizeM <= 0 ? 0 : holeSizeM >= cutOff ? 1 : Math.min(1, (holeSizeM / cutOff) ** 3);
  return Math.min(1, Math.max(throughMetal, throughHoles, 1e-12));
}

/** Speed gained by a charge falling through an accelerating potential (m/s). */
export function velocityAfterAcceleration(charge: number, voltage: number, mass: number): number {
  const energy = Math.abs(charge * voltage);
  if (mass <= 0) return Number.NaN;
  return Math.sqrt((2 * energy) / mass);
}
