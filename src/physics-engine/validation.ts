import type { ValidationIssue } from '@/types/lab';

/** Flattens issue lists and drops the empty slots, preserving order. */
export function mergeIssues(
  ...groups: (ValidationIssue | ValidationIssue[] | null | undefined)[]
): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  for (const g of groups) {
    if (!g) continue;
    if (Array.isArray(g)) out.push(...g.filter(Boolean));
    else out.push(g);
  }
  return out;
}

/** Errors when a value leaves its declared bounds or stops being finite. */
export function validateRange(
  field: string,
  label: string,
  value: number,
  min: number,
  max: number
): ValidationIssue | null {
  if (!Number.isFinite(value)) {
    return { field, severity: 'error', message: `${label} is not a usable number.` };
  }
  if (value < min) {
    return {
      field,
      severity: 'error',
      message: `${label} is below the working range of the apparatus (minimum ${min}).`
    };
  }
  if (value > max) {
    return {
      field,
      severity: 'error',
      message: `${label} is above the working range of the apparatus (maximum ${max}).`
    };
  }
  return null;
}

export function validatePositive(
  field: string,
  label: string,
  value: number
): ValidationIssue | null {
  if (!Number.isFinite(value)) {
    return { field, severity: 'error', message: `${label} is not a usable number.` };
  }
  if (value <= 0) {
    return { field, severity: 'error', message: `${label} must be greater than zero.` };
  }
  return null;
}

/** A short-circuit is the classic bench mistake, so it is called out by name. */
export function validateResistance(field: string, value: number): ValidationIssue | null {
  if (!Number.isFinite(value)) {
    return { field, severity: 'error', message: 'Resistance is not a usable number.' };
  }
  if (value < 0) {
    return { field, severity: 'error', message: 'Resistance cannot be negative.' };
  }
  if (value === 0) {
    return {
      field,
      severity: 'warning',
      message: 'Zero resistance short-circuits the cell — the current is limited only by r.'
    };
  }
  return null;
}
