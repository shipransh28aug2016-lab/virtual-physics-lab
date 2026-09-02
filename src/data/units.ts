import type { UnitSlug } from '@/types/lab';

export interface UnitInfo {
  slug: UnitSlug;
  label: string;
  /** The NCERT chapter span this unit covers. */
  ncert: string;
  description: string;
  href: string;
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
    href: '/class-12/electrostatics'
  },
  {
    slug: 'current-electricity',
    label: 'Current Electricity',
    ncert: 'Unit II · Chapter 3',
    description: 'Ohm’s law, resistivity, cells, and Wheatstone networks.',
    href: '/class-12/current-electricity'
  },
  {
    slug: 'magnetism',
    label: 'Magnetic Effects of Current and Magnetism',
    ncert: 'Unit III · Chapters 4–5',
    description: 'Moving charges, Biot–Savart, torque on loops and magnetism.',
    href: '/class-12/magnetism'
  },
  {
    slug: 'emi-ac',
    label: 'Electromagnetic Induction and Alternating Current',
    ncert: 'Unit IV · Chapters 6–7',
    description: 'Faraday’s and Lenz’s laws, inductance, LCR circuits.',
    href: '/class-12/emi-ac'
  },
  {
    slug: 'optics',
    label: 'Optics',
    ncert: 'Unit VI · Chapters 9–10',
    description: 'Reflection, refraction, optical instruments and wave optics.',
    href: '/class-12/optics'
  },
  {
    slug: 'dual-nature',
    label: 'Dual Nature of Radiation and Matter',
    ncert: 'Unit VII · Chapter 11',
    description: 'Photoelectric effect, matter waves and the photon picture.',
    href: '/class-12/dual-nature'
  },
  {
    slug: 'practical-a',
    label: 'Practicals · Section A',
    ncert: 'CBSE practical list · Section A',
    description: 'Electricity and magnetism experiments from the board list.',
    href: '/practicals/section-a'
  },
  {
    slug: 'practical-b',
    label: 'Practicals · Section B',
    ncert: 'CBSE practical list · Section B',
    description: 'Optics and semiconductor experiments from the board list.',
    href: '/practicals/section-b'
  }
];

export const unitInfo = (slug: UnitSlug): UnitInfo | undefined =>
  UNITS.find((u) => u.slug === slug);
