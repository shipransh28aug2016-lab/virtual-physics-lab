import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  width: 16,
  height: 16,
  'aria-hidden': true,
  focusable: false,
  ...props
});

/** Line icons drawn inline so the portable build needs no icon font. */
export const Icons = {
  Atom: (p: IconProps) => (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="1.6" />
      <ellipse cx="12" cy="12" rx="10" ry="4.4" />
      <ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(120 12 12)" />
    </svg>
  ),
  Flask: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M9 3h6M10 3v6L5 19a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 19l-5-10V3" />
      <path d="M7.5 15h9" />
    </svg>
  ),
  Sliders: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  ),
  Notebook: (p: IconProps) => (
    <svg {...base(p)}>
      <rect x="5" y="3" width="15" height="18" rx="2" />
      <path d="M9 3v18M4 7h3M4 12h3M4 17h3M12 8h5M12 12h5" />
    </svg>
  ),
  Target: (p: IconProps) => (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  ),
  Clock: (p: IconProps) => (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  ),
  Compass: (p: IconProps) => (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </svg>
  ),
  ChevronRight: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  ),
  ArrowLeft: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  ),
  Star: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="m12 3.6 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.8l5.9-.8z" />
    </svg>
  ),
  Search: (p: IconProps) => (
    <svg {...base(p)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  ),
  Reset: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v4h-4" />
    </svg>
  ),
  Plus: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Trash: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6" />
    </svg>
  ),
  Warning: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M12 4 2.8 20h18.4z" />
      <path d="M12 10v4.5M12 17.4h.01" />
    </svg>
  ),
  Chart: (p: IconProps) => (
    <svg {...base(p)}>
      <path d="M4 20V4M4 20h16" />
      <path d="m7 15 3.5-4.5L14 14l4-6.5" />
    </svg>
  ),
  Globe: (p: IconProps) => (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </svg>
  )
} as const;

export type IconName = keyof typeof Icons;
