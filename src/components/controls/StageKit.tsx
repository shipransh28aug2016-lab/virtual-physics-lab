import { useCallback, useRef, useState, type ReactNode } from 'react';
import type {
  ControlKind,
  ControlSpec,
  ParamValue,
  ParamValues,
  SliderControl,
  ToggleControl
} from '@/types/lab';
import { clamp } from '@/utils/format';

/** What every `renderStage` receives: the live params and the way to change them. */
export interface StageApi {
  params: ParamValues;
  set: (key: string, value: ParamValue) => void;
  /** Looks a control spec up by key, narrowed to the expected kind. */
  control: <K extends ControlKind>(key: string, kind: K) => Extract<ControlSpec, { kind: K }>;
}

interface HandleProps<S extends ControlSpec> {
  spec: S;
  params: ParamValues;
  onChange: (key: string, value: ParamValue) => void;
  label?: string;
}

/* ── value <-> travel mapping ───────────────────────────────────────────── */

/** Fraction of travel (0–1) for a slider value, honouring a log scale. */
export function fractionOf(spec: SliderControl, value: number): number {
  const { min, max } = spec;
  if (spec.scale === 'log' && min > 0 && max > 0) {
    return clamp((Math.log(value / min) / Math.log(max / min)) || 0, 0, 1);
  }
  return clamp((value - min) / (max - min || 1), 0, 1);
}

/** Inverse of {@link fractionOf}, snapped to the control's step. */
export function valueOf(spec: SliderControl, fraction: number): number {
  const f = clamp(fraction, 0, 1);
  const { min, max, step } = spec;
  const raw =
    spec.scale === 'log' && min > 0 && max > 0
      ? min * Math.pow(max / min, f)
      : min + f * (max - min);
  const snapped = step > 0 ? Math.round(raw / step) * step : raw;
  const decimals = step > 0 ? Math.max(0, Math.ceil(-Math.log10(step))) : 6;
  return Number(clamp(snapped, min, max).toFixed(Math.min(decimals, 8)));
}

const readNumber = (params: ParamValues, spec: SliderControl): number => {
  const v = Number(params[spec.key]);
  return Number.isFinite(v) ? v : spec.initial;
};

const displayValue = (spec: SliderControl, value: number): string =>
  value.toFixed(spec.precision ?? (spec.step >= 1 ? 0 : 2));

/** Keyboard contract shared by every on-apparatus handle. */
function useSliderKeys(
  spec: SliderControl,
  value: number,
  commit: (v: number) => void
): (e: React.KeyboardEvent) => void {
  return useCallback(
    (e: React.KeyboardEvent) => {
      const big = (spec.max - spec.min) / 10;
      let next: number | null = null;
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          next = value + spec.step;
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          next = value - spec.step;
          break;
        case 'PageUp':
          next = value + big;
          break;
        case 'PageDown':
          next = value - big;
          break;
        case 'Home':
          next = spec.min;
          break;
        case 'End':
          next = spec.max;
          break;
        default:
          return;
      }
      e.preventDefault();
      commit(valueOf(spec, fractionOf(spec, clamp(next, spec.min, spec.max))));
    },
    [spec, value, commit]
  );
}

/** Tracks a pointer drag on an SVG element and reports the delta in user units. */
function usePointerDrag(
  onMove: (dx: number, dy: number, start: { x: number; y: number }) => void
): {
  onPointerDown: (e: React.PointerEvent) => void;
  dragging: boolean;
} {
  const [dragging, setDragging] = useState(false);
  const origin = useRef({ x: 0, y: 0 });
  const move = useRef(onMove);
  move.current = onMove;

  const toUser = (e: { clientX: number; clientY: number }, el: SVGGraphicsElement) => {
    const svg = el.ownerSVGElement ?? (el as unknown as SVGSVGElement);
    const pt = svg.createSVGPoint?.();
    const ctm = svg.getScreenCTM?.();
    if (!pt || !ctm) return { x: e.clientX, y: e.clientY };
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const el = e.currentTarget as unknown as SVGGraphicsElement;
    origin.current = toUser(e, el);
    setDragging(true);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    e.preventDefault();

    const onPointerMove = (ev: PointerEvent) => {
      const p = toUser(ev, el);
      move.current(p.x - origin.current.x, p.y - origin.current.y, origin.current);
    };
    const stop = () => {
      setDragging(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }, []);

  return { onPointerDown, dragging };
}

/* ── Knob ───────────────────────────────────────────────────────────────── */

const KNOB_SWEEP = 270; // degrees of travel, centred on the top of the dial

export interface KnobProps extends HandleProps<SliderControl> {
  x: number;
  y: number;
  radius?: number;
}

/**
 * A real rotary control: `role="slider"` with full keyboard support, pointer
 * drag around the dial, and a live value plate underneath.
 */
export function Knob({ spec, params, onChange, x, y, radius = 20, label }: KnobProps) {
  const value = readNumber(params, spec);
  const fraction = fractionOf(spec, value);
  const angle = -KNOB_SWEEP / 2 + fraction * KNOB_SWEEP;
  const disabled = spec.disabledIf?.(params) ?? false;

  const commit = useCallback(
    (v: number) => {
      if (!disabled) onChange(spec.key, v);
    },
    [disabled, onChange, spec.key]
  );

  const { onPointerDown, dragging } = usePointerDrag((dx, dy) => {
    // Angle of the pointer about the knob centre maps directly onto the travel.
    const theta = Math.atan2(dy + 0, dx + 0);
    const deg = (theta * 180) / Math.PI + 90;
    const wrapped = ((deg + 180) % 360) - 180;
    const f = clamp((wrapped + KNOB_SWEEP / 2) / KNOB_SWEEP, 0, 1);
    commit(valueOf(spec, f));
  });

  const onKeyDown = useSliderKeys(spec, value, commit);
  const rad = ((angle - 90) * Math.PI) / 180;

  return (
    <g
      className={`stage-ctl stage-knob${dragging ? ' is-dragging' : ''}${disabled ? ' is-disabled' : ''}`}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label ?? `${spec.label}${spec.unit ? ` in ${spec.unit}` : ''}`}
      aria-valuemin={spec.min}
      aria-valuemax={spec.max}
      aria-valuenow={value}
      aria-valuetext={`${displayValue(spec, value)}${spec.unit ? ` ${spec.unit}` : ''}`}
      aria-disabled={disabled || undefined}
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      onPointerDown={disabled ? undefined : onPointerDown}
      transform={`translate(${x} ${y})`}
    >
      <circle r={radius + 6} className="stage-ctl-hit" fill="transparent" />
      <circle r={radius} className="knob-body" />
      <circle r={radius - 5} className="knob-face" />
      <path
        d={describeArc(0, 0, radius + 3, -KNOB_SWEEP / 2, KNOB_SWEEP / 2)}
        className="knob-track"
        fill="none"
      />
      <path
        d={describeArc(0, 0, radius + 3, -KNOB_SWEEP / 2, angle)}
        className="knob-fill"
        fill="none"
      />
      <line
        x1={0}
        y1={0}
        x2={Math.cos(rad) * (radius - 6)}
        y2={Math.sin(rad) * (radius - 6)}
        className="knob-pointer"
      />
      <circle r={2.4} className="knob-hub stage-pin" />
      <text y={radius + 15} textAnchor="middle" className="stage-ctl-value">
        {displayValue(spec, value)}
        {spec.unit ? ` ${spec.unit}` : ''}
      </text>
      <text y={-radius - 8} textAnchor="middle" className="stage-ctl-label">
        {spec.label}
      </text>
    </g>
  );
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, from: number, to: number): string {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

/* ── Switch ─────────────────────────────────────────────────────────────── */

export interface StageSwitchProps extends HandleProps<ToggleControl> {
  x: number;
  y: number;
}

/** A plug key on the board: `role="switch"`, Space/Enter to throw it. */
export function StageSwitch({ spec, params, onChange, x, y, label }: StageSwitchProps) {
  const on = Boolean(params[spec.key] ?? spec.initial);
  const disabled = spec.disabledIf?.(params) ?? false;
  const toggle = () => {
    if (!disabled) onChange(spec.key, !on);
  };

  return (
    <g
      className={`stage-ctl stage-switch${on ? ' is-on' : ''}${disabled ? ' is-disabled' : ''}`}
      role="switch"
      tabIndex={disabled ? -1 : 0}
      aria-label={label ?? spec.label}
      aria-checked={on}
      aria-disabled={disabled || undefined}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          toggle();
        }
      }}
      transform={`translate(${x} ${y})`}
    >
      <rect x={-24} y={-14} width={48} height={28} rx={14} className="stage-ctl-hit" fill="transparent" />
      <rect x={-20} y={-10} width={40} height={20} rx={10} className="switch-track" />
      <circle cx={on ? 10 : -10} cy={0} r={7.5} className="switch-thumb stage-pin" />
      <text y={24} textAnchor="middle" className="stage-ctl-value">
        {on ? 'CLOSED' : 'OPEN'}
      </text>
      <text y={-18} textAnchor="middle" className="stage-ctl-label">
        {spec.label}
      </text>
    </g>
  );
}

/* ── Linear drag handles ────────────────────────────────────────────────── */

export interface DragMapping {
  /** Converts a pixel delta along the track into a control value. */
  toValue: (delta: number) => number;
  /** Converts a control value back into a pixel coordinate on the track. */
  invert: (value: number) => number;
}

interface DragProps extends HandleProps<SliderControl> {
  x: number;
  y: number;
  mapping?: DragMapping;
}

export interface DragXProps extends DragProps {
  length: number;
}

/** A jockey/slider that rides a horizontal track — metre bridge, optical bench. */
export function DragX({ spec, params, onChange, x, y, length, mapping, label }: DragXProps) {
  const value = readNumber(params, spec);
  const disabled = spec.disabledIf?.(params) ?? false;
  const commit = useCallback(
    (v: number) => {
      if (!disabled) onChange(spec.key, valueOf(spec, fractionOf(spec, clamp(v, spec.min, spec.max))));
    },
    [disabled, onChange, spec]
  );

  const handleX = mapping ? mapping.invert(value) : x + fractionOf(spec, value) * length;
  const startValue = useRef(value);
  const { onPointerDown, dragging } = usePointerDrag((dx) => {
    commit(
      mapping ? mapping.toValue(dx) + startValue.current : valueOf(spec, fractionOf(spec, startValue.current) + dx / length)
    );
  });
  const onKeyDown = useSliderKeys(spec, value, commit);

  return (
    <g
      className={`stage-ctl stage-drag-x${dragging ? ' is-dragging' : ''}${disabled ? ' is-disabled' : ''}`}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label ?? spec.label}
      aria-valuemin={spec.min}
      aria-valuemax={spec.max}
      aria-valuenow={value}
      aria-valuetext={`${displayValue(spec, value)}${spec.unit ? ` ${spec.unit}` : ''}`}
      aria-orientation="horizontal"
      aria-disabled={disabled || undefined}
      onKeyDown={onKeyDown}
      onPointerDown={
        disabled
          ? undefined
          : (e) => {
              startValue.current = value;
              onPointerDown(e);
            }
      }
    >
      <line x1={x} y1={y} x2={x + length} y2={y} className="drag-track" />
      <g transform={`translate(${handleX} ${y})`}>
        <rect x={-14} y={-16} width={28} height={32} className="stage-ctl-hit" fill="transparent" />
        <path d="M 0 -12 L 7 -2 L 0 8 L -7 -2 Z" className="drag-handle stage-pin" />
        <text y={22} textAnchor="middle" className="stage-ctl-value">
          {displayValue(spec, value)}
          {spec.unit ? ` ${spec.unit}` : ''}
        </text>
      </g>
    </g>
  );
}

export interface DragYProps extends DragProps {
  height: number;
}

/** The vertical twin of {@link DragX} — object height, plate separation. */
export function DragY({ spec, params, onChange, x, y, height, mapping, label }: DragYProps) {
  const value = readNumber(params, spec);
  const disabled = spec.disabledIf?.(params) ?? false;
  const commit = useCallback(
    (v: number) => {
      if (!disabled) onChange(spec.key, valueOf(spec, fractionOf(spec, clamp(v, spec.min, spec.max))));
    },
    [disabled, onChange, spec]
  );

  const handleY = mapping ? mapping.invert(value) : y - fractionOf(spec, value) * height;
  const startValue = useRef(value);
  const { onPointerDown, dragging } = usePointerDrag((_dx, dy) => {
    commit(
      mapping
        ? mapping.toValue(dy) + startValue.current
        : valueOf(spec, fractionOf(spec, startValue.current) - dy / height)
    );
  });
  const onKeyDown = useSliderKeys(spec, value, commit);

  return (
    <g
      className={`stage-ctl stage-drag-y${dragging ? ' is-dragging' : ''}${disabled ? ' is-disabled' : ''}`}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label ?? spec.label}
      aria-valuemin={spec.min}
      aria-valuemax={spec.max}
      aria-valuenow={value}
      aria-valuetext={`${displayValue(spec, value)}${spec.unit ? ` ${spec.unit}` : ''}`}
      aria-orientation="vertical"
      aria-disabled={disabled || undefined}
      onKeyDown={onKeyDown}
      onPointerDown={
        disabled
          ? undefined
          : (e) => {
              startValue.current = value;
              onPointerDown(e);
            }
      }
    >
      <line x1={x} y1={y} x2={x} y2={y - height} className="drag-track" />
      <g transform={`translate(${x} ${handleY})`}>
        <rect x={-16} y={-14} width={32} height={28} className="stage-ctl-hit" fill="transparent" />
        <path d="M -12 0 L -2 -7 L 8 0 L -2 7 Z" className="drag-handle stage-pin" />
        <text x={16} y={4} className="stage-ctl-value" textAnchor="start">
          {displayValue(spec, value)}
          {spec.unit ? ` ${spec.unit}` : ''}
        </text>
      </g>
    </g>
  );
}

/** A titled group used by stages to keep handles out of the drawing. */
export function StageDock({ children, x, y }: { children: ReactNode; x: number; y: number }) {
  return <g className="stage-dock" transform={`translate(${x} ${y})`}>{children}</g>;
}
