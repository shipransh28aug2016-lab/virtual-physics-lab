import type { TerminalState } from '@/lab/interaction/useConnect';

export interface TerminalProps {
  id: string;
  x: number;
  y: number;
  /** Plain-language name: "Cell, positive terminal". */
  label: string;
  /** What a screen reader is told about the current state and the next action. */
  description: string;
  state: TerminalState;
  /** True when this is the terminal the student is holding a lead against. */
  held: boolean;
  polarity?: '+' | '-' | null;
  onPress: (id: string) => void;
  onDetach: (id: string) => void;
  radius?: number;
}

/**
 * A 4 mm socket on the bench.
 *
 * It is a real button: `role="button"`, always in the tab order, Enter/Space to
 * take a lead or put one down, Delete/Backspace to pull every lead out. The
 * pointer and the keyboard drive the same two-press gesture, so there is no
 * second accessible path that could drift out of step with the visible one.
 *
 * The ring colour follows the state machine, never a coordinate — a terminal
 * that merely looks touched is not connected.
 */
export function Terminal({
  id,
  x,
  y,
  label,
  description,
  state,
  held,
  polarity,
  onPress,
  onDetach,
  radius = 7
}: TerminalProps) {
  return (
    <g
      className={`bench-terminal is-${state}${held ? ' is-held' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-description={description}
      aria-pressed={held}
      transform={`translate(${x} ${y})`}
      onClick={() => onPress(id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPress(id);
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          onDetach(id);
        }
      }}
    >
      {/* A touch target big enough for a finger, invisible to the drawing. */}
      <circle r={Math.max(radius + 9, 16)} fill="transparent" className="bench-terminal-hit" />
      <circle r={radius + 2.5} className="terminal-collar" />
      <circle r={radius} className="terminal-socket" />
      <circle r={radius - 3.4} className="terminal-bore" />
      {polarity ? (
        <text y={-radius - 6} textAnchor="middle" className="terminal-polarity">
          {polarity === '+' ? '+' : '−'}
        </text>
      ) : null}
    </g>
  );
}
