import type { ControlSpec, ParamValue, ParamValues, SliderControl } from '@/types/lab';
import { Tex } from '@/components/math/Tex';

interface ControlsProps {
  specs: ControlSpec[];
  params: ParamValues;
  onChange: (key: string, value: ParamValue) => void;
}

const display = (spec: SliderControl, v: number) =>
  v.toFixed(spec.precision ?? (spec.step >= 1 ? 0 : 2));

/** The bench strip: native controls for anything not pinned to the apparatus. */
export function Controls({ specs, params, onChange }: ControlsProps) {
  if (specs.length === 0) return null;
  return (
    <section className="panel control-dock" aria-label="Apparatus controls">
      <div className="panel-body control-grid">
        {specs.map((spec) => {
          const disabled = spec.disabledIf?.(params) ?? false;
          const id = `ctl-${spec.key}`;
          return (
            <div key={spec.key} className={`control${disabled ? ' is-disabled' : ''}`}>
              <label htmlFor={id}>
                <span className="control-label">
                  {spec.label}
                  {spec.symbol ? (
                    <em>
                      {' '}
                      <Tex>{spec.symbol}</Tex>
                    </em>
                  ) : null}
                </span>
                {spec.kind === 'slider' ? (
                  <span className="readout control-value">
                    {display(spec, Number(params[spec.key] ?? spec.initial))}
                    {spec.unit ? ` ${spec.unit}` : ''}
                  </span>
                ) : null}
              </label>

              {spec.kind === 'slider' ? (
                <input
                  id={id}
                  type="range"
                  min={spec.min}
                  max={spec.max}
                  step={spec.step}
                  value={Number(params[spec.key] ?? spec.initial)}
                  disabled={disabled}
                  onChange={(e) => onChange(spec.key, Number(e.target.value))}
                />
              ) : null}

              {spec.kind === 'toggle' ? (
                <button
                  id={id}
                  type="button"
                  role="switch"
                  aria-checked={Boolean(params[spec.key] ?? spec.initial)}
                  className={`switch-btn${params[spec.key] ?? spec.initial ? ' is-on' : ''}`}
                  disabled={disabled}
                  onClick={() => onChange(spec.key, !(params[spec.key] ?? spec.initial))}
                >
                  {params[spec.key] ?? spec.initial ? 'On' : 'Off'}
                </button>
              ) : null}

              {spec.kind === 'select' ? (
                <select
                  id={id}
                  value={String(params[spec.key] ?? spec.initial)}
                  disabled={disabled}
                  onChange={(e) => onChange(spec.key, e.target.value)}
                >
                  {spec.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : null}

              {spec.kind === 'segmented' ? (
                <div className="segmented" role="radiogroup" aria-labelledby={id}>
                  {spec.options.map((o) => {
                    const active = String(params[spec.key] ?? spec.initial) === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={`segmented-btn${active ? ' is-active' : ''}`}
                        disabled={disabled}
                        onClick={() => onChange(spec.key, o.value)}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {spec.hint ? <p className="control-hint muted">{spec.hint}</p> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
