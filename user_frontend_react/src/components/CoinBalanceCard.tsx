import BoltRounded from '@mui/icons-material/BoltRounded';
import TrendingUpRounded from '@mui/icons-material/TrendingUpRounded';
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRounded from '@mui/icons-material/ArrowDownwardRounded';
import { WebTokens, glow, withAlpha } from '@/theme/webTokens';
import { Fmt } from '@/core/utils/format';

function WeekDeltaChip({ delta }: { delta: number }) {
  const up = delta >= 0;
  const Arrow = up ? ArrowUpwardRounded : ArrowDownwardRounded;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '5px 9px',
        background: withAlpha(WebTokens.onAccent, 0.16),
        borderRadius: 999,
        color: WebTokens.onAccent,
        fontSize: 11.5,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      <Arrow sx={{ fontSize: 12 }} />
      {Fmt.compactNumber(Math.abs(delta))} this week
    </span>
  );
}

/**
 * Rich "My Points" hero — balance + this-week delta + earned-all-time
 * secondary stat, with a large faint decorative glyph for depth.
 * Port of `CoinBalanceCard`.
 */
export function CoinBalanceCard({
  balance,
  thisWeekDelta,
  earnedTotal,
}: {
  balance: number;
  thisWeekDelta?: number | null;
  earnedTotal?: number | null;
}) {
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '24px 26px',
        background: `linear-gradient(135deg, ${WebTokens.accent}, ${WebTokens.accentDeep})`,
        borderRadius: WebTokens.radiusCard,
        boxShadow: glow(WebTokens.accent, 0.3),
        color: WebTokens.onAccent,
      }}
    >
      {/* Large faint glyph for depth — a plain flat gradient card read as too
          bare for a headline "my points" moment. */}
      <BoltRounded
        aria-hidden="true"
        sx={{ fontSize: 160 }}
        style={{
          position: 'absolute',
          right: -26,
          bottom: -30,
          color: withAlpha(WebTokens.onAccent, 0.1),
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              padding: 7,
              display: 'inline-flex',
              background: withAlpha(WebTokens.onAccent, 0.16),
              borderRadius: 9,
            }}
          >
            <BoltRounded sx={{ fontSize: 16 }} />
          </span>
          <span style={{ fontWeight: 800, fontSize: 12, letterSpacing: 1.6 }}>MY POINTS</span>
          {thisWeekDelta != null && (
            <>
              <span style={{ flex: 1 }} />
              <WeekDeltaChip delta={thisWeekDelta} />
            </>
          )}
        </div>

        <div style={{ height: 22 }} />

        <div style={{ fontWeight: 800, fontSize: 44, lineHeight: 1 }}>
          {Fmt.compactNumber(balance)}
        </div>
        <div style={{ marginTop: 4, fontSize: 13, fontWeight: 600 }}>points available</div>

        {earnedTotal != null && (
          <>
            <div
              style={{
                height: 1,
                marginTop: 20,
                background: withAlpha(WebTokens.onAccent, 0.16),
              }}
            />
            <div
              style={{
                marginTop: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: withAlpha(WebTokens.onAccent, 0.85),
                fontSize: 12.5,
                fontWeight: 600,
              }}
            >
              <TrendingUpRounded sx={{ fontSize: 15 }} />
              {Fmt.compactNumber(earnedTotal)} earned all-time
            </div>
          </>
        )}
      </div>
    </div>
  );
}
