import { useId } from 'react';
import { WebTokens, withAlpha } from '@/theme/webTokens';
import { useCountUp } from '@/hooks/useCountUp';

/**
 * The arc half of `_GaugePainter` on its own — a sweep-gradient progress arc
 * over a flat track, animated on first build. Shared by GaugeRing and the
 * current node of the profile LevelPath.
 */
export function GaugeArc({
  value,
  color,
  size,
  strokeWidth,
  animate = true,
}: {
  /** 0..1 */
  value: number;
  color: string;
  size: number;
  strokeWidth: number;
  animate?: boolean;
}) {
  const gradientId = useId();
  const v = useCountUp(Math.min(Math.max(value, 0), 1), 900, animate);

  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      // Flutter starts the sweep at -pi/2 (12 o'clock); SVG circles start at
      // 3 o'clock, so rotate the whole thing back a quarter turn.
      style={{ transform: 'rotate(-90deg)' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={withAlpha(color, 0.45)} />
          <stop offset="100%" stopColor={color} />
        </linearGradient>
      </defs>
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={WebTokens.surfaceAlt}
        strokeWidth={strokeWidth}
      />
      {v > 0 && (
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - v)}
        />
      )}
    </svg>
  );
}

/**
 * Gauge ring — donut progress with a centered value (fintech "health score"
 * pattern). Port of `GaugeRing`.
 */
export function GaugeRing({
  value,
  label,
  accent = WebTokens.accent,
  size = 104,
  strokeWidth = 10,
  centerText,
}: {
  /** 0..1 */
  value: number;
  label: string;
  accent?: string;
  size?: number;
  strokeWidth?: number;
  centerText?: string;
}) {
  const clamped = Math.min(Math.max(value, 0), 1);
  const animated = useCountUp(clamped, 900);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: size, height: size, position: 'relative' }}>
        <GaugeArc value={clamped} color={accent} size={size} strokeWidth={strokeWidth} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size * 0.2,
            fontWeight: 800,
            color: WebTokens.textPrimary,
          }}
        >
          {centerText ?? `${Math.round(animated * 100)}%`}
        </div>
      </div>
      <p
        style={{
          marginTop: 10,
          textAlign: 'center',
          color: WebTokens.textSecondary,
          fontSize: 12.5,
          fontWeight: 600,
        }}
      >
        {label}
      </p>
    </div>
  );
}
