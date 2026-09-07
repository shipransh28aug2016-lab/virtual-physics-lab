import { useState, type ReactNode } from 'react';
import { Apparatus3D, type Apparatus3DProps } from '@/components/instruments/Apparatus3D';

export interface ApparatusViewProps {
  /** The existing SVG ray-diagram bench. */
  ray2d: ReactNode;
  apparatus3d: Apparatus3DProps;
}

/**
 * Toggles a mirror/lens stage between its 2D ray diagram and the 3D
 * apparatus view, without touching either apparatus's own logic or the
 * speech/audio engine (both live on the shared `SimulatorShell` chrome
 * around this).
 */
export function ApparatusView({ ray2d, apparatus3d }: ApparatusViewProps) {
  const [mode, setMode] = useState<'2d' | '3d'>('2d');

  return (
    <div className="apparatus-view">
      <button
        type="button"
        className="view-pill apparatus-view-toggle"
        onClick={() => setMode((m) => (m === '2d' ? '3d' : '2d'))}
        aria-pressed={mode === '3d'}
      >
        {mode === '2d' ? '3D Apparatus View' : '2D Ray Diagram View'}
      </button>
      {mode === '2d' ? ray2d : <Apparatus3D {...apparatus3d} />}
    </div>
  );
}
