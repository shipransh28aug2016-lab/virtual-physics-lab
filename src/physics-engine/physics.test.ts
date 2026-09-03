import { describe, expect, it } from 'vitest';
import { CONSTANTS, E_OVER_M, HC_EV_NM } from './constants';
import {
  ammeterShunt,
  cellsInParallel,
  cellsInSeries,
  diodeCurrent,
  galvanometerFigureOfMerit,
  galvanometerResistanceHalfDeflection,
  internalResistanceFromPotentiometer,
  loopCurrent,
  metreBridgeBalanceLength,
  parallelResistance,
  rcCharge,
  rcDischarge,
  resistanceAtTemperature,
  resistivityFromMetreBridge,
  resistivityFromWire,
  rlGrowth,
  seriesResistance,
  terminalVoltage,
  voltmeterMultiplier,
  wireResistance
} from './circuits';
import {
  cageShielding,
  coulombForce,
  electricFieldPointCharge,
  electricFieldSuperposition,
  parallelPlateCapacitor,
  potentialPointCharge,
  skinDepth,
  velocityAfterAcceleration
} from './electrostatics';
import {
  coilAxialField,
  cyclotronFrequency,
  cyclotronMaxEnergy,
  forceOnWire,
  gyroradius,
  idealSolenoidField,
  lorentzForce,
  magneticFlux,
  straightWireField
} from './magnetism';
import {
  centralMaximumHalfWidth,
  criticalAngle,
  doubleSlitIntensity,
  fringeWidth,
  hypermetropiaCorrection,
  lensImage,
  lensPower,
  lensesInContact,
  malusIntensity,
  minimumDeviation,
  mirrorImage,
  myopiaCorrection,
  prismDeviation,
  refractiveIndexFromDepth,
  refractiveIndexFromPrism,
  singleSlitIntensity,
  snellRefraction,
  telescopeNormalAdjustment,
  traceSlab,
  wavelengthToRgb
} from './optics';
import { deBroglieFromVoltage, photoelectricEffect } from './quantum';
import {
  linearDensityFromWire,
  resonantLength,
  stringFrequency,
  tensionFromMass
} from './waves-acoustics';
import { degToRad, jToEv, radToDeg } from './units';
import { linearFit } from './numerical';
import { mag2 } from './vectors';
import { mergeIssues, validatePositive, validateRange, validateResistance } from './validation';

/**
 * These are NCERT/CODATA anchor values. If a model change breaks one of them,
 * the model is wrong — not the test.
 */
describe('constants', () => {
  it('reproduces the specific charge of the electron', () => {
    expect(E_OVER_M).toBeCloseTo(1.7588e11, -7);
  });

  it('gives hc as 1240 eV nm to three figures', () => {
    expect(HC_EV_NM).toBeCloseTo(1239.84, 1);
  });

  it('has a Coulomb constant consistent with 1/(4πε₀)', () => {
    expect(CONSTANTS.K_E).toBeCloseTo(1 / (4 * Math.PI * CONSTANTS.EPSILON_0), -4);
  });
});

describe('circuits', () => {
  it('applies Ohm’s law around a single loop', () => {
    const cell = { emf: 6, internalResistance: 0.5 };
    expect(loopCurrent(cell, 11.5)).toBeCloseTo(0.5, 10);
    expect(terminalVoltage(cell, 0.5)).toBeCloseTo(5.75, 10);
  });

  it('combines resistances in series and parallel', () => {
    expect(seriesResistance([4, 6])).toBe(10);
    expect(parallelResistance([4, 6])).toBeCloseTo(2.4, 10);
    // A zero-resistance branch shorts the network out.
    expect(parallelResistance([4, 0])).toBe(0);
  });

  it('combines cells in series and in parallel', () => {
    const cell = { emf: 1.5, internalResistance: 0.4 };
    expect(cellsInSeries([cell, cell, cell])).toEqual({ emf: 4.5, internalResistance: 1.2000000000000002 });
    const p = cellsInParallel([cell, cell]);
    expect(p.emf).toBeCloseTo(1.5, 10);
    expect(p.internalResistance).toBeCloseTo(0.2, 10);
  });

  it('balances a metre bridge at the ratio of the arms', () => {
    // Equal arms balance at the midpoint of the wire.
    expect(metreBridgeBalanceLength(5, 5)).toBeCloseTo(50, 10);
    expect(metreBridgeBalanceLength(5, 10)).toBeCloseTo(66.6667, 3);
    const r = resistivityFromMetreBridge(5, 50, 0.0002, 1);
    expect(r.unknownResistance).toBeCloseTo(5, 6);
    expect(r.resistivity).toBeCloseTo(5 * Math.PI * 4e-8, 12);
  });

  it('relates resistance and resistivity through the geometry', () => {
    const rho = 4.9e-7;
    const R = wireResistance(rho, 0.6, 0.000225);
    expect(resistivityFromWire(R, 0.000225, 0.6)).toBeCloseTo(rho, 12);
  });

  it('models the galvanometer experiments', () => {
    // Half deflection: G = SR/(R − S).
    expect(galvanometerResistanceHalfDeflection(1000, 60)).toBeCloseTo(63.8298, 3);
    expect(galvanometerFigureOfMerit(2, 2000, 20)).toBeCloseTo(5e-5, 12);
    // Converting a 60 Ω, 5 mA movement into a 1 A ammeter.
    expect(ammeterShunt(60, 0.005, 1)).toBeCloseTo(0.30151, 4);
    // …and into a 10 V voltmeter.
    expect(voltmeterMultiplier(60, 0.005, 10)).toBeCloseTo(1940, 6);
  });

  it('gives the internal resistance from a potentiometer', () => {
    expect(internalResistanceFromPotentiometer(60, 50, 5)).toBeCloseTo(1, 10);
  });

  it('makes a diode conduct forwards and block backwards', () => {
    const fwd = diodeCurrent(1e-9, 0.7, 300);
    const rev = diodeCurrent(1e-9, -0.7, 300);
    expect(fwd).toBeGreaterThan(1e-3);
    expect(rev).toBeCloseTo(-1e-9, 12);
  });

  it('charges and discharges a capacitor through one time constant', () => {
    const r = 1000;
    const c = 1e-3;
    expect(rcCharge(10, r, c, r * c)).toBeCloseTo(6.3212, 4);
    expect(rcDischarge(10, r, c, r * c)).toBeCloseTo(3.6788, 4);
  });

  it('builds current in an inductor over one time constant', () => {
    expect(rlGrowth(1, 20, 0.25, 0.25 / 20)).toBeCloseTo(0.63212, 5);
  });

  it('raises the resistance of a metal with temperature', () => {
    expect(resistanceAtTemperature(10, 0.00393, 120, 20)).toBeCloseTo(13.93, 10);
  });
});

describe('electrostatics', () => {
  it('gives the Coulomb force between two microcoulomb charges', () => {
    // Two 1 µC charges 1 m apart repel with about 9 mN.
    expect(coulombForce(1e-6, 1e-6, 1)).toBeCloseTo(8.9876e-3, 6);
    expect(coulombForce(1e-6, -1e-6, 1)).toBeLessThan(0);
  });

  it('gives the field and potential of a point charge', () => {
    expect(electricFieldPointCharge(1e-6, 1)).toBeCloseTo(8987.55, 1);
    expect(potentialPointCharge(1e-6, 1)).toBeCloseTo(8987.55, 1);
  });

  it('cancels the field midway between two equal like charges', () => {
    const e = electricFieldSuperposition(
      [
        { q: 1e-6, pos: { x: -0.1, y: 0 } },
        { q: 1e-6, pos: { x: 0.1, y: 0 } }
      ],
      { x: 0, y: 0 }
    );
    expect(mag2(e)).toBeCloseTo(0, 9);
  });

  it('models a parallel plate capacitor', () => {
    const c = parallelPlateCapacitor({ area: 0.01, separation: 0.001, kappa: 1, voltage: 100 });
    expect(c.capacitance).toBeCloseTo(8.854e-11, 13);
    expect(c.field).toBeCloseTo(1e5, 6);
    expect(c.energy).toBeCloseTo(0.5 * c.capacitance * 1e4, 15);
    // A dielectric multiplies the capacitance by κ.
    const withK = parallelPlateCapacitor({ area: 0.01, separation: 0.001, kappa: 4, voltage: 100 });
    expect(withK.capacitance / c.capacitance).toBeCloseTo(4, 10);
  });

  it('shields better as the shell gets thicker', () => {
    const thin = cageShielding(1e6, 5.8e7, 1e-5, 1e-4);
    const thick = cageShielding(1e6, 5.8e7, 1e-3, 1e-4);
    expect(thick).toBeLessThan(thin);
    expect(skinDepth(1e6, 5.8e7)).toBeCloseTo(6.6e-5, 5);
  });

  it('accelerates an electron through a potential difference', () => {
    const v = velocityAfterAcceleration(CONSTANTS.E_CHARGE, 100, CONSTANTS.M_E);
    expect(v).toBeCloseTo(5.93e6, -4);
  });
});

describe('magnetism', () => {
  it('gives the cyclotron frequency of a proton', () => {
    // A proton in a 1 T field circulates at about 15.2 MHz.
    expect(cyclotronFrequency(CONSTANTS.E_CHARGE, 1, CONSTANTS.M_P)).toBeCloseTo(1.5245e7, -4);
  });

  it('gives the cyclotron energy independent of the injected speed', () => {
    const e = cyclotronMaxEnergy(CONSTANTS.E_CHARGE, 1, 0.5, CONSTANTS.M_P);
    expect(jToEv(e) / 1e6).toBeCloseTo(11.98, 1);
  });

  it('applies the Lorentz and motor rules', () => {
    expect(lorentzForce(1, 2, 3, 90)).toBeCloseTo(6, 10);
    expect(lorentzForce(1, 2, 3, 0)).toBeCloseTo(0, 12);
    expect(forceOnWire(0.5, 2, 0.1, 90)).toBeCloseTo(0.1, 10);
    expect(forceOnWire(0.5, 2, 0.1, 30)).toBeCloseTo(0.05, 10);
  });

  it('gives the radius of a charged particle’s circular path', () => {
    expect(gyroradius(CONSTANTS.M_E, 1e7, CONSTANTS.E_CHARGE, 0.001)).toBeCloseTo(5.686e-2, 4);
  });

  it('gives the field of a solenoid, a coil and a straight wire', () => {
    expect(idealSolenoidField(2, 1000)).toBeCloseTo(CONSTANTS.MU_0 * 2000, 12);
    // At the centre of a coil the axial formula reduces to µ₀NI/2a.
    expect(coilAxialField(1, 0.1, 1, 0)).toBeCloseTo((CONSTANTS.MU_0 * 1) / (2 * 0.1), 12);
    expect(straightWireField(1, 0.01)).toBeCloseTo(2e-5, 7);
  });

  it('gives the flux through a coil', () => {
    expect(magneticFlux(0.5, 0.02, 100, 0)).toBeCloseTo(1, 10);
    expect(magneticFlux(0.5, 0.02, 100, 90)).toBeCloseTo(0, 12);
  });
});

describe('optics', () => {
  it('forms a real inverted image in a convex lens', () => {
    // Object at 2F: image at 2F, inverted, same size.
    const img = lensImage(0.3, 0.15, 0.02);
    expect(img.imageDistance).toBeCloseTo(0.3, 10);
    expect(img.magnification).toBeCloseTo(-1, 10);
    expect(img.isReal).toBe(true);
    expect(img.isErect).toBe(false);
    expect(img.imageHeight).toBeCloseTo(-0.02, 10);
  });

  it('forms a virtual erect image in a concave lens', () => {
    const img = lensImage(0.3, -0.15, 0.02);
    expect(img.imageDistance).toBeCloseTo(-0.1, 10);
    expect(img.isReal).toBe(false);
    expect(img.isErect).toBe(true);
  });

  it('satisfies the mirror equation for a concave mirror', () => {
    // R = 24 cm → f = −12 cm; object at 30 cm gives a real image at −20 cm.
    const img = mirrorImage(0.3, 0.24, true, 0.02);
    expect(img.focalLength).toBeCloseTo(-0.12, 10);
    expect(img.imageDistance).toBeCloseTo(-0.2, 10);
    expect(img.magnification).toBeCloseTo(-2 / 3, 10);
    expect(img.isReal).toBe(true);
  });

  it('always gives a virtual erect image in a convex mirror', () => {
    const img = mirrorImage(0.3, 0.24, false, 0.02);
    expect(img.focalLength).toBeCloseTo(0.12, 10);
    expect(img.isReal).toBe(false);
    expect(img.isErect).toBe(true);
    expect(Math.abs(img.magnification)).toBeLessThan(1);
  });

  it('gives lens power in dioptre and combines lenses in contact', () => {
    expect(lensPower(0.2)).toBeCloseTo(5, 10);
    expect(lensesInContact(0.2, -0.5)).toBeCloseTo(1 / (5 - 2), 10);
  });

  it('refracts by Snell’s law and finds the critical angle', () => {
    expect(snellRefraction(30, 1, 1.5)).toBeCloseTo(19.4712, 3);
    // NCERT anchor: the critical angle for n = 1.5 is 41.81°.
    expect(criticalAngle(1.5, 1)).toBeCloseTo(41.8103, 3);
    expect(Number.isNaN(snellRefraction(60, 1.5, 1))).toBe(true);
  });

  it('shifts a ray sideways through a parallel-sided slab', () => {
    const t = traceSlab(0.05, 45, 1.5);
    expect(t.refractedDeg).toBeCloseTo(28.1255, 3);
    // d = t sin(i − r)/cos r
    expect(t.shift).toBeCloseTo((0.05 * Math.sin(degToRad(45 - 28.1255))) / Math.cos(degToRad(28.1255)), 6);
    expect(t.rays.length).toBeGreaterThan(2);
  });

  it('finds the minimum deviation of a prism and recovers n from it', () => {
    // A 60° crown-glass prism of n = 1.5 has δm = 37.18°.
    const dm = minimumDeviation(60, 1.5);
    expect(dm).toBeCloseTo(37.1803, 3);
    expect(refractiveIndexFromPrism(60, dm)).toBeCloseTo(1.5, 8);
    // The deviation at the symmetric incidence equals δm.
    expect(prismDeviation((60 + dm) / 2, 60, 1.5)).toBeCloseTo(dm, 6);
    // …and is larger on either side of it.
    expect(prismDeviation(40, 60, 1.5)).toBeGreaterThan(dm);
    expect(prismDeviation(60, 60, 1.5)).toBeGreaterThan(dm);
  });

  it('gives the refractive index from real and apparent depth', () => {
    expect(refractiveIndexFromDepth(15, 10)).toBeCloseTo(1.5, 10);
  });

  it('obeys Malus’s law', () => {
    expect(malusIntensity(1, 0)).toBeCloseTo(1, 10);
    expect(malusIntensity(1, 60)).toBeCloseTo(0.25, 10);
    expect(malusIntensity(1, 90)).toBeCloseTo(0, 12);
  });

  it('places double-slit fringes and single-slit minima', () => {
    const beta = fringeWidth(589e-9, 1.5, 0.5e-3);
    expect(beta).toBeCloseTo(1.767e-3, 6);
    // The centre and the first bright fringe are both maxima.
    expect(doubleSlitIntensity(0, 589e-9, 1.5, 0.5e-3)).toBeCloseTo(1, 10);
    expect(doubleSlitIntensity(beta, 589e-9, 1.5, 0.5e-3)).toBeCloseTo(1, 8);
    // The first single-slit minimum sits at y = λD/a.
    const y1 = (589e-9 * 1.5) / 100e-6;
    expect(singleSlitIntensity(y1, 589e-9, 1.5, 100e-6)).toBeCloseTo(0, 8);
    expect(singleSlitIntensity(0, 589e-9, 1.5, 100e-6)).toBeCloseTo(1, 10);
    expect(centralMaximumHalfWidth(589e-9, 100e-6)).toBeCloseTo(0.3375, 3);
  });

  it('gives telescope magnification and tube length', () => {
    const t = telescopeNormalAdjustment(1.0, 0.05);
    expect(t.magnification).toBeCloseTo(-20, 10);
    expect(t.tubeLength).toBeCloseTo(1.05, 10);
  });

  it('prescribes the correcting lens for each defect of vision', () => {
    // Myopia with a far point of 2 m needs a −0.5 D concave lens.
    expect(myopiaCorrection(2)).toBeCloseTo(-2, 10);
    expect(lensPower(myopiaCorrection(2))).toBeCloseTo(-0.5, 10);
    // Hypermetropia with a near point of 75 cm needs +2.67 D.
    const f = hypermetropiaCorrection(0.75);
    expect(f).toBeCloseTo(0.375, 6);
    expect(lensPower(f)).toBeCloseTo(2.6667, 3);
  });

  it('renders wavelengths inside the visible band', () => {
    const green = wavelengthToRgb(530);
    expect(green.g).toBeGreaterThan(green.r);
    expect(green.g).toBeGreaterThan(green.b);
    const red = wavelengthToRgb(680);
    expect(red.r).toBeGreaterThan(red.b);
  });
});

describe('quantum', () => {
  it('applies Einstein’s photoelectric equation', () => {
    // Sodium, φ = 2.28 eV, illuminated at 6.0 × 10¹⁴ Hz.
    const r = photoelectricEffect({ frequency: 6e14, workFunctionEv: 2.28, intensity: 1, stoppingVoltage: 0 });
    expect(r.photonEnergyEv).toBeCloseTo(2.4816, 3);
    expect(r.maxKineticEnergyEv).toBeCloseTo(0.2016, 3);
    expect(r.stoppingPotential).toBeCloseTo(0.2016, 3);
    expect(r.emits).toBe(true);
    expect(r.thresholdWavelengthNm).toBeCloseTo(543.8, 1);
  });

  it('emits nothing below the threshold, whatever the intensity', () => {
    const dim = photoelectricEffect({ frequency: 4e14, workFunctionEv: 2.28, intensity: 0.1, stoppingVoltage: 0 });
    const bright = photoelectricEffect({ frequency: 4e14, workFunctionEv: 2.28, intensity: 1, stoppingVoltage: 0 });
    expect(dim.emits).toBe(false);
    expect(bright.emits).toBe(false);
    expect(bright.netCurrent).toBe(0);
  });

  it('saturates the photocurrent with intensity but not the stopping potential', () => {
    const a = photoelectricEffect({ frequency: 8e14, workFunctionEv: 2.28, intensity: 0.5, stoppingVoltage: 0 });
    const b = photoelectricEffect({ frequency: 8e14, workFunctionEv: 2.28, intensity: 1, stoppingVoltage: 0 });
    expect(b.saturationCurrent).toBeCloseTo(2 * a.saturationCurrent, 12);
    expect(b.stoppingPotential).toBeCloseTo(a.stoppingPotential, 12);
  });

  it('gives the de Broglie wavelength of an accelerated electron', () => {
    // The classic 1.227 nm / √V result, at 100 V.
    expect(deBroglieFromVoltage(100) * 1e9).toBeCloseTo(0.1227, 3);
  });
});

describe('waves and acoustics', () => {
  it('gives the frequency of a stretched string', () => {
    const mu = linearDensityFromWire(7800, 0.35e-3);
    const t = tensionFromMass(2);
    const f = stringFrequency(0.4, t, mu);
    expect(f).toBeGreaterThan(0);
    // The resonating length inverts the frequency relation exactly.
    expect(resonantLength(f, t, mu)).toBeCloseTo(0.4, 10);
  });

  it('halves the frequency when the length is doubled', () => {
    const mu = linearDensityFromWire(7800, 0.35e-3);
    const t = tensionFromMass(2);
    expect(stringFrequency(0.8, t, mu)).toBeCloseTo(stringFrequency(0.4, t, mu) / 2, 8);
  });
});

describe('helpers', () => {
  it('converts between degrees and radians', () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI, 12);
    expect(radToDeg(Math.PI / 2)).toBeCloseTo(90, 12);
  });

  it('fits a straight line through computed points', () => {
    const fit = linearFit([
      { x: 0, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 5 },
      { x: 3, y: 7 }
    ]);
    expect(fit.slope).toBeCloseTo(2, 10);
    expect(fit.intercept).toBeCloseTo(1, 10);
    expect(fit.r2).toBeCloseTo(1, 10);
  });

  it('never lets a validation issue pass silently', () => {
    expect(validateRange('x', 'X', 5, 0, 3)?.severity).toBe('error');
    expect(validateRange('x', 'X', Number.NaN, 0, 3)?.severity).toBe('error');
    expect(validateRange('x', 'X', 2, 0, 3)).toBeNull();
    expect(validatePositive('x', 'X', -1)?.severity).toBe('error');
    expect(validateResistance('r', 0)?.severity).toBe('warning');
    expect(validateResistance('r', 10)).toBeNull();
    expect(mergeIssues(null, validateRange('x', 'X', 5, 0, 3), [])).toHaveLength(1);
  });
});
