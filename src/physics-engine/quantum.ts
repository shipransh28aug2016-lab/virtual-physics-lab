import { CONSTANTS, HC_EV_NM } from './constants';
import { jToEv } from './units';

export interface PhotoelectricInput {
  /** Incident frequency in Hz. */
  frequency: number;
  /** Work function of the emitter in eV. */
  workFunctionEv: number;
  /** Relative beam intensity, 0–1 (scales the saturation current only). */
  intensity: number;
  /** Collector potential in volts; negative values retard the electrons. */
  stoppingVoltage: number;
}

export interface PhotoelectricResult {
  photonEnergyEv: number;
  thresholdFrequency: number;
  thresholdWavelengthNm: number;
  maxKineticEnergyEv: number;
  stoppingPotential: number;
  saturationCurrent: number;
  netCurrent: number;
  emits: boolean;
}

/** Saturation photocurrent at full intensity, in ampere — a bench-scale value. */
const FULL_SCALE_CURRENT = 12e-6;

/**
 * Einstein's photoelectric equation.
 *
 *   E = hν,  K_max = hν − φ,  eV₀ = K_max
 *
 * Emission is a threshold effect: below ν₀ = φ/h no electrons are released no
 * matter how intense the beam. Above it, the current saturates with intensity
 * while the stopping potential depends only on the frequency.
 */
export function photoelectricEffect(input: PhotoelectricInput): PhotoelectricResult {
  const { frequency, workFunctionEv, intensity, stoppingVoltage } = input;

  const photonEnergyEv = jToEv(CONSTANTS.H_PLANCK * frequency);
  const thresholdFrequency = (workFunctionEv * CONSTANTS.EV) / CONSTANTS.H_PLANCK;
  const thresholdWavelengthNm = workFunctionEv > 0 ? HC_EV_NM / workFunctionEv : Number.POSITIVE_INFINITY;

  const maxKineticEnergyEv = photonEnergyEv - workFunctionEv;
  const emits = maxKineticEnergyEv > 0;
  const stoppingPotential = emits ? maxKineticEnergyEv : 0;

  const saturationCurrent = emits ? FULL_SCALE_CURRENT * Math.max(0, Math.min(intensity, 1)) : 0;

  // A retarding potential cuts off progressively; beyond V₀ nothing gets across.
  let netCurrent = 0;
  if (emits) {
    if (stoppingVoltage >= 0) {
      netCurrent = saturationCurrent;
    } else if (-stoppingVoltage < stoppingPotential) {
      const fraction = 1 - -stoppingVoltage / stoppingPotential;
      netCurrent = saturationCurrent * fraction ** 1.5;
    }
  }

  return {
    photonEnergyEv,
    thresholdFrequency,
    thresholdWavelengthNm,
    maxKineticEnergyEv: emits ? maxKineticEnergyEv : 0,
    stoppingPotential,
    saturationCurrent,
    netCurrent,
    emits
  };
}

/** de Broglie wavelength λ = h/p (m). */
export const deBroglieWavelength = (momentum: number): number =>
  momentum === 0 ? Number.POSITIVE_INFINITY : CONSTANTS.H_PLANCK / momentum;

/** de Broglie wavelength of an electron accelerated through V volts (m). */
export const deBroglieFromVoltage = (voltage: number): number =>
  voltage <= 0
    ? Number.POSITIVE_INFINITY
    : CONSTANTS.H_PLANCK /
      Math.sqrt(2 * CONSTANTS.M_E * CONSTANTS.E_CHARGE * voltage);

/** Bohr orbit radius for hydrogen-like atoms, r = 0.529 Å · n²/Z. */
export const bohrRadius = (n: number, z = 1): number => (0.529e-10 * n * n) / z;

/** Bohr energy level, E = −13.6 Z²/n² eV. */
export const bohrEnergyEv = (n: number, z = 1): number => (-13.6 * z * z) / (n * n);

/** Photon wavelength for a hydrogen transition n_i → n_f, in nanometres. */
export function hydrogenLineNm(ni: number, nf: number, z = 1): number {
  const deltaEv = Math.abs(bohrEnergyEv(nf, z) - bohrEnergyEv(ni, z));
  return deltaEv === 0 ? Number.POSITIVE_INFINITY : HC_EV_NM / deltaEv;
}

/** Radioactive decay N(t) = N₀e^{−λt} with λ = ln2/T½. */
export const decayRemaining = (n0: number, halfLife: number, t: number): number =>
  halfLife <= 0 ? n0 : n0 * Math.exp((-Math.LN2 * t) / halfLife);

/** Mass defect converted to binding energy, in MeV. */
export const bindingEnergyMev = (massDefectAmu: number): number => massDefectAmu * 931.5;
