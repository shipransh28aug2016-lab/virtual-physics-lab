import { CONSTANTS } from './constants';

export const degToRad = (deg: number): number => (deg * Math.PI) / 180;
export const radToDeg = (rad: number): number => (rad * 180) / Math.PI;

/** Joules → electronvolts. */
export const jToEv = (joules: number): number => joules / CONSTANTS.EV;
/** Electronvolts → joules. */
export const evToJ = (ev: number): number => ev * CONSTANTS.EV;

export const cmToM = (cm: number): number => cm / 100;
export const mToCm = (m: number): number => m * 100;
export const mmToM = (mm: number): number => mm / 1000;
export const nmToM = (nm: number): number => nm * 1e-9;

/** Kelvin from Celsius, guarding against unphysical inputs. */
export const celsiusToKelvin = (c: number): number => Math.max(c + 273.15, 0);
