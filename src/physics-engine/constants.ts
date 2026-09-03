/**
 * CODATA-2018 physical constants in SI base units. The engine works exclusively
 * in SI; unit conversion happens at the edges, in the experiment modules.
 */
export const CONSTANTS = {
  /** Elementary charge (C). */
  E_CHARGE: 1.602176634e-19,
  /** Electron rest mass (kg). */
  M_E: 9.1093837015e-31,
  /** Proton rest mass (kg). */
  M_P: 1.67262192369e-27,
  /** Neutron rest mass (kg). */
  M_N: 1.67492749804e-27,
  /** Unified atomic mass unit (kg). */
  AMU: 1.66053906660e-27,
  /** Speed of light in vacuum (m/s), exact. */
  C_LIGHT: 2.99792458e8,
  /** Planck constant (J s), exact. */
  H_PLANCK: 6.62607015e-34,
  /** Reduced Planck constant (J s). */
  H_BAR: 1.054571817e-34,
  /** Boltzmann constant (J/K), exact. */
  K_B: 1.380649e-23,
  /** Vacuum permittivity (F/m). */
  EPSILON_0: 8.8541878128e-12,
  /** Vacuum permeability (T m/A). */
  MU_0: 1.25663706212e-6,
  /** Coulomb constant 1/(4πε₀) (N m²/C²). */
  K_E: 8.9875517923e9,
  /** One electronvolt in joules (J/eV). */
  EV: 1.602176634e-19,
  /** Standard gravity (m/s²). */
  G_ACCEL: 9.80665,
  /** Avogadro constant (1/mol). */
  N_A: 6.02214076e23
} as const;

/** hc expressed in eV·nm — the workhorse of photoelectric arithmetic. */
export const HC_EV_NM =
  (CONSTANTS.H_PLANCK * CONSTANTS.C_LIGHT) / CONSTANTS.EV / 1e-9;

/** Specific charge of the electron, e/m (C/kg). NCERT anchor: 1.7588×10¹¹. */
export const E_OVER_M = CONSTANTS.E_CHARGE / CONSTANTS.M_E;
