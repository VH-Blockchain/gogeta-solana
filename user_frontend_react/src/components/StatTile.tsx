import type { ReactNode } from 'react';
import { WebTokens, withAlpha } from '@/theme/webTokens';
import { useCountUp } from '@/hooks/useCountUp';
import { Sparkline } from './Sparkline';
import { WebCard } from './WebCard';

/** ▲/▼ change indicator. */
function DeltaChip({ delta }: { delta: number }) {
  const up = delta >= 0;
  const color = up ? WebTokens.accent : WebTokens.danger;
  return (
    <span
      style={{
        padding: '4px 8px',
        background: withAlpha(color, 0.12),
        borderRadius: 999,
        color,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {up ? '▲' : '▼'} {Math.abs(delta)}
    </span>
  );
}

/**
 * Neo KPI tile — count-up value, delta chip, sparkline. Port of `StatTile`.
 *
 * Neutral card: color lives only in the icon chip, not a full-card tinted
 * wash + colored border (that read as every tile being in a highlighted/alert
 * state instead of a calm stat display).
 */
export function StatTile({
  icon,
  label,
  value,
  accent = WebTokens.accent,
  delta,
  sparkline,
  countTo,
  countFormatter,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent?: string;
  delta?: number | null;
  sparkline?: number[] | null;
  /** When set, the value counts up from 0 on first render. */
  countTo?: number | null;
  countFormatter?: (v: number) => string;
}) {
  const counted = useCountUp(countTo ?? 0, 900, countTo != null);

  return (
    <WebCard hoverLift>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              padding: 9,
              display: 'inline-flex',
              background: `linear-gradient(135deg, ${withAlpha(accent, 0.22)}, ${withAlpha(accent, 0.08)})`,
              borderRadius: 11,
              border: `1px solid ${withAlpha(accent, 0.25)}`,
              color: accent,
              fontSize: 18,
            }}
          >
            {icon}
          </span>
          <span
            className="ellipsis"
            style={{
              flex: 1,
              color: WebTokens.textSecondary,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {label}
          </span>
          {delta != null && <DeltaChip delta={delta} />}
        </div>

        <div style={{ height: 14 }} />

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          <span
            className="f-opensans t-headline-medium"
            style={{ flex: 1, minWidth: 0, fontWeight: 600 }}
          >
            {countTo != null
              ? (countFormatter?.(counted) ?? Math.round(counted).toString())
              : value}
          </span>
          {sparkline && sparkline.length > 1 && (
            <Sparkline values={sparkline} color={accent} width={84} height={30} />
          )}
        </div>
      </div>
    </WebCard>
  );
}
