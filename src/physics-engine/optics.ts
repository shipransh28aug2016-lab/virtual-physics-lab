import { degToRad, radToDeg } from './units';

export interface ImageResult {
  /** Signed image distance in metres, Cartesian convention. */
  imageDistance: number;
  magnification: number;
  imageHeight: number;
  isReal: boolean;
  isErect: boolean;
}

export interface MirrorResult extends ImageResult {
  /** Signed focal length in metres: −R/2 concave, +R/2 convex. */
  focalLength: number;
}

/**
 * Thin lens. `objectDistanceM` is the *magnitude* of the object distance as read
 * off the bench; the Cartesian sign is applied internally (u = −|u|). A positive
 * focal length is converging, negative diverging.
 *
 *   1/v − 1/u = 1/f,   m = v/u
 */
export function lensImage(
  objectDistanceM: number,
  focalLengthM: number,
  objectHeightM = 0
): ImageResult {
  const u = -Math.abs(objectDistanceM);
  if (focalLengthM === 0 || u === 0) {
    return {
      imageDistance: Number.NaN,
      magnification: Number.NaN,
      imageHeight: Number.NaN,
      isReal: false,
      isErect: true
    };
  }
  const invV = 1 / focalLengthM + 1 / u;
  const imageDistance = Math.abs(invV) < 1e-12 ? Number.POSITIVE_INFINITY : 1 / invV;
  const magnification = Number.isFinite(imageDistance)
    ? imageDistance / u
    : Number.POSITIVE_INFINITY;
  return {
    imageDistance,
    magnification,
    imageHeight: magnification * objectHeightM,
    // For a lens the image is real when it forms on the far side of the lens.
    isReal: Number.isFinite(imageDistance) && imageDistance > 0,
    isErect: magnification > 0
  };
}

/** Lens power in dioptre, P = 1/f with f in metres. */
export const lensPower = (focalLengthM: number): number =>
  focalLengthM === 0 ? Number.POSITIVE_INFINITY : 1 / focalLengthM;

/** Lens-maker's equation for a thin lens in air. */
export function lensMakerFocalLength(n: number, r1M: number, r2M: number): number {
  const invF = (n - 1) * (1 / r1M - 1 / r2M);
  return Math.abs(invF) < 1e-12 ? Number.POSITIVE_INFINITY : 1 / invF;
}

/** Equivalent focal length of two thin lenses in contact. */
export function lensesInContact(f1M: number, f2M: number): number {
  const invF = 1 / f1M + 1 / f2M;
  return Math.abs(invF) < 1e-12 ? Number.POSITIVE_INFINITY : 1 / invF;
}

/**
 * Spherical mirror. `objectDistanceM` is the magnitude read off the bench and
 * `radiusM` the magnitude of the radius of curvature.
 *
 *   1/v + 1/u = 1/f,   f = −R/2 (concave) or +R/2 (convex),   m = −v/u
 */
export function mirrorImage(
  objectDistanceM: number,
  radiusM: number,
  concave: boolean,
  objectHeightM = 0
): MirrorResult {
  const focalLength = (concave ? -1 : 1) * (Math.abs(radiusM) / 2);
  const u = -Math.abs(objectDistanceM);
  if (focalLength === 0 || u === 0) {
    return {
      focalLength,
      imageDistance: Number.NaN,
      magnification: Number.NaN,
      imageHeight: Number.NaN,
      isReal: false,
      isErect: true
    };
  }
  const invV = 1 / focalLength - 1 / u;
  const imageDistance = Math.abs(invV) < 1e-12 ? Number.POSITIVE_INFINITY : 1 / invV;
  const magnification = Number.isFinite(imageDistance)
    ? -imageDistance / u
    : Number.POSITIVE_INFINITY;
  return {
    focalLength,
    imageDistance,
    magnification,
    imageHeight: magnification * objectHeightM,
    // For a mirror the image is real when it forms in front of the mirror (v < 0).
    isReal: Number.isFinite(imageDistance) && imageDistance < 0,
    isErect: magnification > 0
  };
}

/** Snell's law; returns the refraction angle in degrees, NaN past the TIR limit. */
export function snellRefraction(incidenceDeg: number, n1: number, n2: number): number {
  const s = (n1 * Math.sin(degToRad(incidenceDeg))) / n2;
  return Math.abs(s) > 1 ? Number.NaN : radToDeg(Math.asin(s));
}

/** Critical angle in degrees for n1 → n2 (only defined when n1 > n2). */
export function criticalAngle(n1: number, n2 = 1): number {
  if (n1 <= n2) return Number.NaN;
  return radToDeg(Math.asin(n2 / n1));
}

export interface SlabRay {
  from: { x: number; y: number };
  to: { x: number; y: number };
  kind: 'incident' | 'refracted' | 'emergent' | 'undeviated';
}

export interface SlabTrace {
  refractedDeg: number;
  /** Lateral shift d = t·sin(i − r)/cos r, in metres. */
  shift: number;
  rays: SlabRay[];
}

/**
 * Traces a ray through a parallel-sided glass slab.
 *
 * Frame: the entry face lies along y = 0, the slab occupies y ∈ [−t, 0], the ray
 * enters at the origin and travels into decreasing y. All lengths are metres.
 */
export function traceSlab(thicknessM: number, incidenceDeg: number, n: number): SlabTrace {
  const t = Math.max(thicknessM, 0);
  const i = degToRad(incidenceDeg);
  const rDeg = snellRefraction(incidenceDeg, 1, n);
  const r = Number.isFinite(rDeg) ? degToRad(rDeg) : 0;
  const shift = Math.cos(r) === 0 ? 0 : (t * Math.sin(i - r)) / Math.cos(r);
  const exitX = t * Math.tan(r);
  const lead = Math.max(t * 1.6, 0.02);

  const rays: SlabRay[] = [
    {
      from: { x: -lead * Math.sin(i), y: lead * Math.cos(i) },
      to: { x: 0, y: 0 },
      kind: 'incident'
    },
    { from: { x: 0, y: 0 }, to: { x: exitX, y: -t }, kind: 'refracted' },
    {
      from: { x: exitX, y: -t },
      to: { x: exitX + lead * Math.sin(i), y: -t - lead * Math.cos(i) },
      kind: 'emergent'
    },
    {
      from: { x: 0, y: 0 },
      to: { x: lead * Math.sin(i) * 1.4, y: -lead * Math.cos(i) * 1.4 },
      kind: 'undeviated'
    }
  ];

  return { refractedDeg: Number.isFinite(rDeg) ? rDeg : Number.NaN, shift, rays };
}

/**
 * Prism deviation δ = i + e − A, with e obtained by tracing through both faces.
 * Returns NaN when the ray is totally internally reflected at the second face.
 */
export function prismDeviation(incidenceDeg: number, apexAngleDeg: number, n: number): number {
  const r1 = snellRefraction(incidenceDeg, 1, n);
  if (!Number.isFinite(r1)) return Number.NaN;
  const r2 = apexAngleDeg - r1;
  const e = snellRefraction(r2, n, 1);
  if (!Number.isFinite(e)) return Number.NaN;
  return incidenceDeg + e - apexAngleDeg;
}

/** Minimum deviation for a prism: δ_min = 2·asin(n·sin(A/2)) − A, in degrees. */
export function minimumDeviation(apexAngleDeg: number, n: number): number {
  const s = n * Math.sin(degToRad(apexAngleDeg / 2));
  if (Math.abs(s) > 1) return Number.NaN;
  return 2 * radToDeg(Math.asin(s)) - apexAngleDeg;
}

/** Prism formula: n = sin((A + δ_min)/2) / sin(A/2). */
export function refractiveIndexFromPrism(apexAngleDeg: number, minDeviationDeg: number): number {
  const denom = Math.sin(degToRad(apexAngleDeg / 2));
  if (denom === 0) return Number.NaN;
  return Math.sin(degToRad((apexAngleDeg + minDeviationDeg) / 2)) / denom;
}

/** Apparent-depth method: n = real depth / apparent depth. */
export const refractiveIndexFromDepth = (realDepth: number, apparentDepth: number): number =>
  apparentDepth === 0 ? Number.NaN : realDepth / apparentDepth;

/** Malus's law I = I₀cos²θ, θ in degrees. */
export const malusIntensity = (i0: number, angleDeg: number): number =>
  i0 * Math.cos(degToRad(angleDeg)) ** 2;

/** Young's double slit fringe width β = λD/d (all lengths in metres). */
export const fringeWidth = (wavelengthM: number, screenDistanceM: number, slitSepM: number): number =>
  slitSepM === 0 ? Number.POSITIVE_INFINITY : (wavelengthM * screenDistanceM) / slitSepM;

/** Double-slit intensity at a screen position y, normalised to I₀ = 4·I_single. */
export function doubleSlitIntensity(
  yM: number,
  wavelengthM: number,
  screenDistanceM: number,
  slitSepM: number
): number {
  const phase = (Math.PI * slitSepM * yM) / (wavelengthM * screenDistanceM);
  return Math.cos(phase) ** 2;
}

/** Single-slit diffraction intensity, the sinc² pattern normalised to 1. */
export function singleSlitIntensity(
  yM: number,
  wavelengthM: number,
  screenDistanceM: number,
  slitWidthM: number
): number {
  const beta = (Math.PI * slitWidthM * yM) / (wavelengthM * screenDistanceM);
  if (Math.abs(beta) < 1e-9) return 1;
  return (Math.sin(beta) / beta) ** 2;
}

/** Half-angular width of the central diffraction maximum, in degrees. */
export const centralMaximumHalfWidth = (wavelengthM: number, slitWidthM: number): number =>
  slitWidthM === 0 ? Number.NaN : radToDeg(Math.asin(Math.min(1, wavelengthM / slitWidthM)));

/** Astronomical telescope in normal adjustment: m = −f_o/f_e, L = f_o + f_e. */
export function telescopeNormalAdjustment(
  objectiveF: number,
  eyepieceF: number
): { magnification: number; tubeLength: number } {
  return {
    magnification: eyepieceF === 0 ? Number.NaN : -objectiveF / eyepieceF,
    tubeLength: objectiveF + eyepieceF
  };
}

/** Telescope with the final image at the near point D: m = −(f_o/f_e)(1 + f_e/D). */
export const telescopeNearPoint = (
  objectiveF: number,
  eyepieceF: number,
  nearPoint = 0.25
): number => (eyepieceF === 0 ? Number.NaN : -(objectiveF / eyepieceF) * (1 + eyepieceF / nearPoint));

/** Compound microscope magnification m = (L/f_o)(D/f_e), approximate form. */
export const microscopeMagnification = (
  tubeLength: number,
  objectiveF: number,
  eyepieceF: number,
  nearPoint = 0.25
): number =>
  objectiveF === 0 || eyepieceF === 0
    ? Number.NaN
    : (tubeLength / objectiveF) * (nearPoint / eyepieceF);

/** Correcting lens for myopia: f = −(far point). */
export const myopiaCorrection = (farPointM: number): number => -Math.abs(farPointM);

/**
 * Correcting lens for hypermetropia so that an object at the normal near point
 * D forms its virtual image at the eye's own near point:
 *   1/f = 1/(−d_n) − 1/(−D)
 */
export function hypermetropiaCorrection(nearPointM: number, normalNearPoint = 0.25): number {
  const dn = Math.abs(nearPointM);
  if (Math.abs(dn - normalNearPoint) < 1e-9) return Number.POSITIVE_INFINITY;
  return (normalNearPoint * dn) / (dn - normalNearPoint);
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * Approximate sRGB rendering of a monochromatic wavelength (380–780 nm), using
 * the standard piecewise fit with intensity roll-off at the spectrum edges.
 */
export function wavelengthToRgb(wavelengthNm: number): Rgb {
  const w = wavelengthNm;
  let r = 0;
  let g = 0;
  let b = 0;

  if (w >= 380 && w < 440) {
    r = -(w - 440) / (440 - 380);
    b = 1;
  } else if (w >= 440 && w < 490) {
    g = (w - 440) / (490 - 440);
    b = 1;
  } else if (w >= 490 && w < 510) {
    g = 1;
    b = -(w - 510) / (510 - 490);
  } else if (w >= 510 && w < 580) {
    r = (w - 510) / (580 - 510);
    g = 1;
  } else if (w >= 580 && w < 645) {
    r = 1;
    g = -(w - 645) / (645 - 580);
  } else if (w >= 645 && w <= 780) {
    r = 1;
  } else {
    // Outside the visible band: render ultraviolet violet and infrared deep red.
    if (w < 380) {
      r = 0.4;
      b = 0.7;
    } else {
      r = 0.5;
    }
  }

  let factor = 1;
  if (w >= 380 && w < 420) factor = 0.3 + (0.7 * (w - 380)) / 40;
  else if (w > 700 && w <= 780) factor = 0.3 + (0.7 * (780 - w)) / 80;
  else if (w < 380 || w > 780) factor = 0.35;

  const to8 = (v: number) => Math.round(255 * Math.min(1, Math.max(0, v * factor)) ** 0.8);
  return { r: to8(r), g: to8(g), b: to8(b) };
}
