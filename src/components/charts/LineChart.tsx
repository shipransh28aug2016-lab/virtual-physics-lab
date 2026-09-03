import { useMemo } from 'react';
import type { GraphSpec, Point } from '@/types/lab';
import { formatSI } from '@/utils/format';

const PAD = { left: 58, right: 18, top: 18, bottom: 40 };
const W = 640;
const H = 320;

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function bounds(spec: GraphSpec): Bounds {
  const pts: Point[] = spec.series.flatMap((s) => s.points).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  for (const m of spec.markers ?? []) if (Number.isFinite(m.x) && Number.isFinite(m.y)) pts.push(m);
  if (spec.live && Number.isFinite(spec.live.x) && Number.isFinite(spec.live.y)) pts.push(spec.live);
  if (pts.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };

  let minX = Math.min(...pts.map((p) => p.x));
  let maxX = Math.max(...pts.map((p) => p.x));
  let minY = Math.min(...pts.map((p) => p.y));
  let maxY = Math.max(...pts.map((p) => p.y));

  for (const g of spec.guides ?? []) {
    if (!Number.isFinite(g.value)) continue;
    if (g.axis === 'x') {
      minX = Math.min(minX, g.value);
      maxX = Math.max(maxX, g.value);
    } else {
      minY = Math.min(minY, g.value);
      maxY = Math.max(maxY, g.value);
    }
  }

  // A flat series still deserves a readable band around it.
  if (maxX - minX < 1e-12) {
    minX -= 0.5;
    maxX += 0.5;
  }
  if (maxY - minY < 1e-12) {
    minY -= 0.5;
    maxY += 0.5;
  }
  const padY = (maxY - minY) * 0.08;
  return { minX, maxX, minY: minY - padY, maxY: maxY + padY };
}

/** "Nice" tick values so axes land on round numbers. */
function ticks(min: number, max: number, count = 5): number[] {
  const span = max - min;
  if (!Number.isFinite(span) || span <= 0) return [min];
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm >= 7.5 ? 10 : norm >= 3.5 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
  const first = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = first; v <= max + step * 1e-6; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

/**
 * Plots the series returned by `compute`. Nothing is hard-coded: axes, ticks and
 * the operating point all come from the model output.
 */
export function LineChart({ spec }: { spec: GraphSpec }) {
  const b = useMemo(() => bounds(spec), [spec]);

  const sx = (x: number) => PAD.left + ((x - b.minX) / (b.maxX - b.minX)) * (W - PAD.left - PAD.right);
  const sy = (y: number) => H - PAD.bottom - ((y - b.minY) / (b.maxY - b.minY)) * (H - PAD.top - PAD.bottom);

  const fx = spec.xFormat ?? ((v: number) => formatSI(v, 3));
  const fy = spec.yFormat ?? ((v: number) => formatSI(v, 3));

  const xTicks = ticks(b.minX, b.maxX, 6);
  const yTicks = ticks(b.minY, b.maxY, 5);

  const path = (points: Point[]) =>
    points
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.x).toFixed(2)} ${sy(p.y).toFixed(2)}`)
      .join(' ');

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${spec.title}. ${spec.yLabel} against ${spec.xLabel}.`} className="chart-svg">
        <rect x={PAD.left} y={PAD.top} width={W - PAD.left - PAD.right} height={H - PAD.top - PAD.bottom} className="chart-plot" />

        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line x1={sx(t)} y1={PAD.top} x2={sx(t)} y2={H - PAD.bottom} className="chart-grid" />
            <text x={sx(t)} y={H - PAD.bottom + 16} textAnchor="middle" className="chart-tick">
              {fx(t)}
            </text>
          </g>
        ))}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={PAD.left} y1={sy(t)} x2={W - PAD.right} y2={sy(t)} className="chart-grid" />
            <text x={PAD.left - 8} y={sy(t) + 4} textAnchor="end" className="chart-tick">
              {fy(t)}
            </text>
          </g>
        ))}

        {(spec.guides ?? []).map((g, i) =>
          g.axis === 'x' ? (
            <g key={`g${i}`}>
              <line x1={sx(g.value)} y1={PAD.top} x2={sx(g.value)} y2={H - PAD.bottom} stroke={g.color ?? '#8497ad'} strokeDasharray="5 4" strokeWidth={1.2} />
              {g.label ? (
                <text x={sx(g.value) + 4} y={PAD.top + 12} className="chart-guide-label" fill={g.color ?? '#8497ad'}>
                  {g.label}
                </text>
              ) : null}
            </g>
          ) : (
            <g key={`g${i}`}>
              <line x1={PAD.left} y1={sy(g.value)} x2={W - PAD.right} y2={sy(g.value)} stroke={g.color ?? '#8497ad'} strokeDasharray="5 4" strokeWidth={1.2} />
              {g.label ? (
                <text x={W - PAD.right - 4} y={sy(g.value) - 5} textAnchor="end" className="chart-guide-label" fill={g.color ?? '#8497ad'}>
                  {g.label}
                </text>
              ) : null}
            </g>
          )
        )}

        {spec.series.map((s) => (
          <path
            key={s.key}
            d={path(s.points)}
            className="chart-series"
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeDasharray={s.dashed ? '6 4' : undefined}
          />
        ))}

        {(spec.markers ?? []).map((m, i) =>
          Number.isFinite(m.x) && Number.isFinite(m.y) ? (
            <g key={`m${i}`}>
              <circle cx={sx(m.x)} cy={sy(m.y)} r={4} fill={m.color ?? '#ffc65c'} />
              {m.label ? (
                <text x={sx(m.x) + 8} y={sy(m.y) - 8} className="chart-marker-label" fill={m.color ?? '#ffc65c'}>
                  {m.label}
                </text>
              ) : null}
            </g>
          ) : null
        )}

        {spec.live && Number.isFinite(spec.live.x) && Number.isFinite(spec.live.y) ? (
          <circle cx={sx(spec.live.x)} cy={sy(spec.live.y)} r={5.5} fill="none" stroke="#25d0ee" strokeWidth={2.4} />
        ) : null}

        <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} className="chart-axis" />
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} className="chart-axis" />
        <text x={(PAD.left + W - PAD.right) / 2} y={H - 6} textAnchor="middle" className="chart-axis-label">
          {spec.xLabel}
        </text>
        <text x={14} y={(PAD.top + H - PAD.bottom) / 2} textAnchor="middle" className="chart-axis-label" transform={`rotate(-90 14 ${(PAD.top + H - PAD.bottom) / 2})`}>
          {spec.yLabel}
        </text>
      </svg>
      <figcaption className="chart-caption">
        {spec.title}
        {spec.series.length > 1 ? (
          <span className="chart-legend">
            {spec.series.map((s) => (
              <span key={s.key}>
                <i style={{ background: s.color }} aria-hidden="true" />
                {s.label}
              </span>
            ))}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
