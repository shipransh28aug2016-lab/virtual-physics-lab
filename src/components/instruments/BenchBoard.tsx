/** The wooden bench board every circuit is laid out on. */
export function BenchBoard({
  x,
  y,
  width,
  height,
  rx = 12
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  rx?: number;
}) {
  return (
    <g className="bench-board">
      <rect x={x} y={y} width={width} height={height} rx={rx} fill="url(#lab-wood)" stroke="#1b1209" strokeWidth={1.4} />
      <rect x={x + 6} y={y + 6} width={width - 12} height={height - 12} rx={Math.max(rx - 4, 0)} fill="none" stroke="#6b5136" strokeWidth={1} opacity={0.6} />
    </g>
  );
}
