/**
 * Sonometer / stretched-string acoustics. All lengths in metres, tension in
 * newton and linear density in kg/m.
 */

/** Wave speed on a stretched string, v = √(T/µ). */
export const stringWaveSpeed = (tension: number, linearDensity: number): number =>
  linearDensity <= 0 ? Number.NaN : Math.sqrt(tension / linearDensity);

/**
 * Frequency of the p-th harmonic of a stretched string:
 *   f = (p / 2L)·√(T/µ)
 */
export function stringFrequency(
  lengthM: number,
  tension: number,
  linearDensity: number,
  harmonic = 1
): number {
  if (lengthM <= 0) return Number.NaN;
  return (harmonic / (2 * lengthM)) * stringWaveSpeed(tension, linearDensity);
}

/** Resonating length for a required frequency, L = (p/2f)·√(T/µ). */
export function resonantLength(
  frequency: number,
  tension: number,
  linearDensity: number,
  harmonic = 1
): number {
  if (frequency <= 0) return Number.NaN;
  return (harmonic / (2 * frequency)) * stringWaveSpeed(tension, linearDensity);
}

/** Linear density of a wire from its material density and diameter. */
export const linearDensityFromWire = (densityKgM3: number, diameterM: number): number =>
  densityKgM3 * Math.PI * (diameterM / 2) ** 2;

/** Tension produced by a hanging mass, T = mg. */
export const tensionFromMass = (massKg: number, g = 9.80665): number => massKg * g;

/** Beat frequency between two sources. */
export const beatFrequency = (f1: number, f2: number): number => Math.abs(f1 - f2);

/** Wave speed from frequency and wavelength. */
export const waveSpeed = (frequency: number, wavelengthM: number): number =>
  frequency * wavelengthM;

/** Doppler shift for a moving source and observer along the line of sight. */
export function dopplerFrequency(
  sourceFrequency: number,
  soundSpeed: number,
  observerSpeed: number,
  sourceSpeed: number
): number {
  const denom = soundSpeed - sourceSpeed;
  if (denom === 0) return Number.POSITIVE_INFINITY;
  return (sourceFrequency * (soundSpeed + observerSpeed)) / denom;
}
