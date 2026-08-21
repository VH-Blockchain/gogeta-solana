import { useId } from 'react';
import { withAlpha } from '@/theme/webTokens';

/**
 * Minimal dependency-free sparkline — inline SVG port of `SparklinePainter`
 * (2px round-capped stroke over a fading area fill).
 */
export function Sparkline({
  values,
  color,
  width = 84,
  height = 30,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  const gradientId = useId();
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min === 0 ? 1 : max - min;
  const dx = width / (values.length - 1);

  const points = values.map((v, i) => {
    const x = i * dx;
    const y = height - ((v - min) / span) * height;
    return `${x},${y}`;
  });

  const line = `M ${points.join(' L ')}`;
  const area = `${line} L ${width},${height} L 0,${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={withAlpha(color, 0.25)} />
          <stop offset="100%" stopColor={withAlpha(color, 0)} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
