import type { ReactNode } from 'react';
import { Ray } from '@/components/instruments/Instruments';
import { SvgDefs } from '@/components/shell/Viewport';

export const BENCH_W = 820;
export const BENCH_H = 470;

export interface BenchGeometry {
  /** Pixel x of the optical centre / pole. */
  originX: number;
  /** Pixel y of the principal axis. */
  axisY: number;
  /** Pixels per centimetre. */
  scale: number;
  width: number;
  height: number;
}

/** Bench coordinate frame. `scale` is in pixels per centimetre. */
export const benchGeometry = (scale = 9): BenchGeometry => ({
  originX: BENCH_W / 2,
  axisY: BENCH_H / 2 - 10,
  scale,
  width: BENCH_W,
  height: BENCH_H
});

/** Axial position in centimetres → pixel x. */
export const xOf = (g: BenchGeometry, cm: number): number => g.originX + cm * g.scale;
/** Height in centimetres → pixel y (positive is above the axis). */
export const yOf = (g: BenchGeometry, cm: number): number => g.axisY - cm * g.scale;

export interface BenchRay {
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** 'virtual' rays are drawn dashed, exactly as in a ray diagram. */
  kind?: 'real' | 'virtual' | 'incident';
  color?: string;
}

/** Focus / centre-of-curvature marks along the principal axis. */
export function FocalMarks({
  g,
  values
}: {
  g: BenchGeometry;
  values: { x: number; label: string; color?: string }[];
}) {
  return (
    <g className="focal-marks">
      {values
        .filter((v) => Number.isFinite(v.x))
        .map((v) => (
          <g key={`${v.label}-${v.x}`}>
            <line x1={v.x} y1={g.axisY - 7} x2={v.x} y2={g.axisY + 7} stroke={v.color ?? '#5e7189'} strokeWidth={1.4} />
            <text x={v.x} y={g.axisY + 21} textAnchor="middle" fontSize={10} fill={v.color ?? '#8497ad'}>
              {v.label}
            </text>
          </g>
        ))}
    </g>
  );
}

export interface OpticsBenchProps {
  geometry: BenchGeometry;
  rays: BenchRay[];
  objectX: number;
  /** Object height in centimetres. */
  objectHeight: number;
  image?: { imageDistance: number; imageHeight: number; isReal: boolean };
  optic?: ReactNode;
  title?: string;
  subtitle?: string;
  children?: ReactNode;
}

/**
 * The optical bench: rail, principal axis, object arrow, ray bundle and the
 * image the model computed. Nothing is drawn that the model did not produce.
 */
export function OpticsBench({
  geometry: g,
  rays,
  objectX,
  objectHeight,
  image,
  optic,
  title,
  subtitle,
  children
}: OpticsBenchProps) {
  const imageX = image && Number.isFinite(image.imageDistance) ? xOf(g, image.imageDistance * 100) : null;
  const imageY = image && Number.isFinite(image.imageHeight) ? yOf(g, image.imageHeight * 100) : null;

  return (
    <svg viewBox={`0 0 ${g.width} ${g.height}`} className="svg-lab" preserveAspectRatio="xMidYMid meet">
      <SvgDefs />

      {/* Rail and principal axis. */}
      <rect x={26} y={g.axisY + 74} width={g.width - 52} height={16} rx={4} fill="url(#lab-metal)" opacity={0.5} />
      <line x1={26} y1={g.axisY} x2={g.width - 26} y2={g.axisY} className="dim-line" />

      {title ? (
        <text x={g.width / 2} y={34} textAnchor="middle" fontSize={12.5} fontWeight={600} fill="#eaf1f8">
          {title}
        </text>
      ) : null}
      {subtitle ? (
        <text x={g.width / 2} y={52} textAnchor="middle" fontSize={10.5} fill="#8497ad" fontFamily="ui-monospace, monospace">
          {subtitle}
        </text>
      ) : null}

      {optic}

      {rays.map((r, i) => (
        <Ray
          key={i}
          from={r.from}
          to={r.to}
          color={r.color ?? (r.kind === 'virtual' ? '#8497ad' : '#ffd257')}
          dashed={r.kind === 'virtual'}
          width={r.kind === 'virtual' ? 1.2 : 1.8}
        />
      ))}

      {/* Object arrow. */}
      <g className="bench-object">
        <line x1={objectX} y1={g.axisY} x2={objectX} y2={yOf(g, objectHeight)} stroke="#45d68b" strokeWidth={2.6} />
        <path
          d={`M ${objectX - 5} ${yOf(g, objectHeight) + 8} L ${objectX} ${yOf(g, objectHeight)} L ${objectX + 5} ${yOf(g, objectHeight) + 8} Z`}
          fill="#45d68b"
        />
        <text x={objectX} y={g.axisY + 38} textAnchor="middle" fontSize={10} fill="#45d68b">
          object
        </text>
      </g>

      {/* Image arrow — only when the model actually formed one. */}
      {imageX !== null && imageY !== null && Number.isFinite(imageY) ? (
        <g className="bench-image">
          <line
            x1={imageX}
            y1={g.axisY}
            x2={imageX}
            y2={imageY}
            stroke={image?.isReal ? '#ff6b7d' : '#9d8cff'}
            strokeWidth={2.6}
            strokeDasharray={image?.isReal ? undefined : '5 4'}
          />
          <path
            d={`M ${imageX - 5} ${imageY + (imageY < g.axisY ? 8 : -8)} L ${imageX} ${imageY} L ${imageX + 5} ${imageY + (imageY < g.axisY ? 8 : -8)} Z`}
            fill={image?.isReal ? '#ff6b7d' : '#9d8cff'}
          />
          <text x={imageX} y={g.axisY + 52} textAnchor="middle" fontSize={10} fill={image?.isReal ? '#ff6b7d' : '#9d8cff'}>
            {image?.isReal ? 'real image' : 'virtual image'}
          </text>
        </g>
      ) : null}

      {children}
    </svg>
  );
}
