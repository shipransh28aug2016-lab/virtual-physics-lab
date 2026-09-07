import { useEffect, useRef, useState } from 'react';
import { ApparatusScene, isThreeAvailable, type ApparatusUpdate } from '@/lib/apparatus3d';

export interface Apparatus3DProps extends ApparatusUpdate {
  title: string;
}

/**
 * Mounts the Three.js scene into `#apparatus-3d-container`. Slider changes
 * flow in as prop changes and are pushed onto the existing scene/meshes —
 * the scene itself is created once per mount, never rebuilt per frame.
 */
export function Apparatus3D({ title, ...update }: Apparatus3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ApparatusScene | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!isThreeAvailable()) {
      setFailed(true);
      return;
    }
    try {
      sceneRef.current = new ApparatusScene(el);
    } catch {
      setFailed(true);
    }
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.update(update);
    // Depend on the scalar fields, not `update` itself — a new object is
    // passed in on every render even when the physics hasn't changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update.uCm, update.vCm, update.heightCm, update.isReal, update.kind]);

  return (
    <div className="apparatus-3d-wrap" role="img" aria-label={title}>
      <div id="apparatus-3d-container" ref={containerRef} className="apparatus-3d-container" />
      {failed ? (
        <p className="apparatus-3d-note">3D view unavailable — switch back to the 2D ray diagram.</p>
      ) : null}
    </div>
  );
}
