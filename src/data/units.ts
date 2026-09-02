import type { UnitSlug } from '@/types/lab';

export interface UnitInfo {
  slug: UnitSlug;
  label: string;
  /** The NCERT chapter span this unit covers. */
  ncert: string;
  description: string;
  href: string;
  /**
   * Marks the CBSE 2026-27 theory paper allots to this unit. The board groups
   * units into blocks, so `marks` is the block total and `sharesMarksWith`
   * names the other units in the same block. Absent for the practical sections,
   * which are examined separately out of 30.
   */
  marks?: number;
  sharesMarksWith?: UnitSlug[];
}

/**
 * The CBSE Class XII physics units (2026-27 curriculum), plus the two practical
 * sections. Chapter numbers follow the NCERT Part I / Part II textbooks.
 */
export const UNITS: UnitInfo[] = [
  {
    slug: 'electrostatics',
    label: 'Electrostatics',
    ncert: 'Unit I · Chapters 1–2',
    description: 'Charges, fields, Gauss’s law, potential and capacitance.',
    href: '/class-12/electrostatics',
    marks: 16,
    sharesMarksWith: ['current-electricity']
  },
  {
    slug: 'current-electricity',
    label: 'Current Electricity',
    ncert: 'Unit II · Chapter 3',
    description: 'Ohm’s law, resistivity, cells, and Wheatstone networks.',
    href: '/class-12/current-electricity',
    marks: 16,
    sharesMarksWith: ['electrostatics']
  },
  {
    slug: 'magnetism',
    label: 'Magnetic Effects of Current and Magnetism',
    ncert: 'Unit III · Chapters 4–5',
    description: 'Moving charges, Biot–Savart, torque on loops and magnetism.',
    href: '/class-12/magnetism',
    marks: 17,
    sharesMarksWith: ['emi-ac']
  },
  {
    slug: 'emi-ac',
    label: 'Electromagnetic Induction and Alternating Current',
    ncert: 'Unit IV · Chapters 6–7',
    description: 'Faraday’s and Lenz’s laws, inductance, LCR circuits.',
    href: '/class-12/emi-ac',
    marks: 17,
    sharesMarksWith: ['magnetism']
  },
  {
    slug: 'electromagnetic-waves',
    label: 'Electromagnetic Waves',
    ncert: 'Unit V · Chapter 8',
    description: 'Displacement current, the electromagnetic spectrum and the speed of light.',
    href: '/class-12/electromagnetic-waves',
    marks: 18,
    sharesMarksWith: ['optics']
  },
  {
    slug: 'optics',
    label: 'Optics',
    ncert: 'Unit VI · Chapters 9–10',
    description: 'Reflection, refraction, optical instruments and wave optics.',
    href: '/class-12/optics',
    marks: 18,
    sharesMarksWith: ['electromagnetic-waves']
  },
  {
    slug: 'dual-nature',
    label: 'Dual Nature of Radiation and Matter',
    ncert: 'Unit VII · Chapter 11',
    description: 'Photoelectric effect, matter waves and the photon picture.',
    href: '/class-12/dual-nature',
    marks: 12,
    sharesMarksWith: ['atoms-nuclei']
  },
  {
    slug: 'atoms-nuclei',
    label: 'Atoms and Nuclei',
    ncert: 'Unit VIII · Chapters 12–13',
    description: 'The Bohr model, spectral series, radioactivity and binding energy.',
    href: '/class-12/atoms-nuclei',
    marks: 12,
    sharesMarksWith: ['dual-nature']
  },
  {
    slug: 'electronic-devices',
    label: 'Electronic Devices',
    ncert: 'Unit IX · Chapter 14',
    description: 'Semiconductors, the p–n junction, diodes and their applications.',
    href: '/class-12/electronic-devices',
    marks: 7
  },
  {
    slug: 'practical-a',
    label: 'Practicals · Section A',
    ncert: 'CBSE practical list · Section A',
    description: 'The six listed experiments on resistance, the galvanometer and the frequency of a.c. mains.',
    href: '/practicals/section-a'
  },
  {
    slug: 'practical-b',
    label: 'Practicals · Section B',
    ncert: 'CBSE practical list · Section B',
    description: 'The nine listed experiments on mirrors, lenses, the prism, refractive index and the p–n junction diode.',
    href: '/practicals/section-b'
  }
];

export const unitInfo = (slug: UnitSlug): UnitInfo | undefined =>
  UNITS.find((u) => u.slug === slug);

/** Units that carry theory marks, in CBSE order. */
export const THEORY_UNITS = UNITS.filter((u) => u.marks !== undefined);

/**
 * Total theory marks, counting each shared block once. The CBSE 2026-27 paper
 * is 70 marks of theory plus 30 of practical.
 */
export const THEORY_MARKS = (() => {
  const counted = new Set<UnitSlug>();
  let total = 0;
  for (const u of THEORY_UNITS) {
    if (counted.has(u.slug)) continue;
    total += u.marks ?? 0;
    counted.add(u.slug);
    for (const other of u.sharesMarksWith ?? []) counted.add(other);
  }
  return total;
})();
