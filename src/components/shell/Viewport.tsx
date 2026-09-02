import type { ReactNode } from 'react';

/**
 * Shared SVG gradients, filters and markers. Every stage drops `<SvgDefs/>` in
 * once so the instruments share one set of materials.
 */
export function SvgDefs() {
  return (
    <defs>
      <linearGradient id="lab-metal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#c4d2e0" />
        <stop offset="45%" stopColor="#8fa1b4" />
        <stop offset="100%" stopColor="#5d6c7d" />
      </linearGradient>
      <linearGradient id="lab-brass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f4d79a" />
        <stop offset="50%" stopColor="#c79a4d" />
        <stop offset="100%" stopColor="#8a6528" />
      </linearGradient>
      <linearGradient id="lab-wood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#4a3626" />
        <stop offset="100%" stopColor="#2d2016" />
      </linearGradient>
      <linearGradient id="lab-glass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#9fd8f2" stopOpacity="0.42" />
        <stop offset="55%" stopColor="#c9ecfb" stopOpacity="0.26" />
        <stop offset="100%" stopColor="#7cc2e4" stopOpacity="0.42" />
      </linearGradient>
      <linearGradient id="lab-dial" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f7fafd" />
        <stop offset="100%" stopColor="#d6e0ea" />
      </linearGradient>
      <radialGradient id="lab-bulb" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#fff3c4" />
        <stop offset="100%" stopColor="#ffb454" stopOpacity="0" />
      </radialGradient>
      <marker id="ray-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill="context-stroke" />
      </marker>
      <marker id="ray-head-warm" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill="#ffd257" />
      </marker>
      <marker id="ray-head-cool" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill="#6ee7ff" />
      </marker>
      <filter id="lab-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="3" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

/** A live reading pinned over the apparatus — always fed by the model. */
export function ViewPill({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <span className="view-pill">
      <b>{label}</b>
      <span className="readout">{value}</span>
      {unit ? <i>{unit}</i> : null}
    </span>
  );
}

export interface ViewportProps {
  children: ReactNode;
  overlay?: ReactNode;
  caption?: string;
}

/** The lit bench: bezel, backing board and the experiment SVG scaled to fill. */
export function Viewport({ children, overlay, caption }: ViewportProps) {
  return (
    <div className="viewport">
      <div className="viewport-bezel">
        <div className="viewport-stage stage-bench">{children}</div>
        {overlay ? <div className="viewport-overlay">{overlay}</div> : null}
      </div>
      {caption ? <p className="viewport-caption muted">{caption}</p> : null}
    </div>
  );
}
