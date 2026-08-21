/**
 * A real crown silhouette (band + 3 points + a center jewel), tinted per rank.
 * Material Icons has no crown glyph — this is hand-drawn rather than reaching
 * for an unrelated medal/trophy icon, to match the reference exactly.
 * Port of `_CrownIcon`/`_CrownPainter`.
 */
export function CrownIcon({ color, size }: { color: string; size: number }) {
  const w = size;
  const h = size * 0.8;

  const body = [
    `M ${w * 0.04} ${h * 0.95}`,
    `L ${w * 0.04} ${h * 0.42}`,
    `L ${w * 0.25} ${h * 0.6}`,
    `L ${w * 0.5} ${h * 0.06}`,
    `L ${w * 0.75} ${h * 0.6}`,
    `L ${w * 0.96} ${h * 0.42}`,
    `L ${w * 0.96} ${h * 0.95}`,
    'Z',
  ].join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d={body} fill={color} />
      {/* Base band, slightly wider than the crown body. */}
      <rect x={0} y={h * 0.82} width={w} height={h * 0.18} rx={h * 0.05} fill={color} />
      {/* Center jewel. */}
      <circle cx={w * 0.5} cy={h * 0.32} r={w * 0.07} fill="rgba(255,255,255,0.85)" />
    </svg>
  );
}
