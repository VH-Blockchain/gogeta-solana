import type { ReactNode } from 'react';
import { WebTokens, withAlpha } from '@/theme/webTokens';

/**
 * Glass stat chip inside a page hero: tinted icon tile + value + label.
 * Shared by the Dashboard and Predictions heroes (the Flutter source declared
 * an identical private `_HeroStat` in each).
 */
export function HeroStat({
  icon,
  value,
  label,
  tint,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  tint: string;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 14,
        border: `${WebTokens.borderWidth}px solid ${WebTokens.glassStroke}`,
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: withAlpha(tint, 0.16),
          borderRadius: 10,
          color: tint,
          fontSize: 18,
        }}
      >
        {icon}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        <span
          style={{
            color: WebTokens.textPrimary,
            fontSize: 16,
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        <span
          style={{
            marginTop: 2,
            color: WebTokens.textMuted,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {label}
        </span>
      </span>
    </div>
  );
}

/** The heroes' shared "1.2M / 8.1k / 42" compaction. */
export function compactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

/** The "LIVE ARENA" / "PREDICTION ARENA" eyebrow pill with its pulsing dot. */
export function LiveEyebrow({ label, dmSans = false }: { label: string; dmSans?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '6px 11px',
        background: withAlpha(WebTokens.accent, 0.12),
        borderRadius: 999,
        border: `1px solid ${withAlpha(WebTokens.accent, 0.35)}`,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: WebTokens.accent,
        }}
      />
      <span
        className={dmSans ? 'f-dmsans' : undefined}
        style={{
          color: WebTokens.accent,
          fontSize: 11,
          fontWeight: dmSans ? 700 : 800,
          letterSpacing: 1.3,
        }}
      >
        {label}
      </span>
    </span>
  );
}
