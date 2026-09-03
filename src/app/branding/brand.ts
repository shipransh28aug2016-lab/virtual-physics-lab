export const BRAND = {
  name: 'Virtual Physics Lab',
  fullName: 'Virtual Physics Lab — Interactive CBSE Class XII Physics',
  short: 'VPL',
  curriculum: 'CBSE · NCERT Class XII',
  year: '2026-27',
  tagline: 'Every apparatus is a live simulator, never a picture.'
} as const;

/** Consistent document titles: "<page> · Virtual Physics Lab". */
export const documentTitle = (page?: string): string =>
  page ? `${page} · ${BRAND.name}` : BRAND.fullName;
