import { useNavigate } from 'react-router-dom';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import type { RewardsSummary } from '@/data/api/rewardsRepository';
import { Routes } from '@/router/routes';
import { WebTokens, withAlpha } from '@/theme/webTokens';
import { ActivityRow } from '@/components/ActivityRow';
import { SkeletonCard } from '@/components/Skeleton';

/**
 * Right rail (>=1280px only): a daily-bonus banner (the real Lucky Draw promo)
 * + a live activity feed. This replaces the reference's live-chat panel, which
 * has no honest equivalent in this app (no chat feature exists) — the same
 * discipline as everywhere else: translate the STRUCTURAL slot (a glanceable
 * social-proof panel) onto real data instead of fabricating chat.
 */
export function RightRail({ summary }: { summary: RewardsSummary | null }) {
  const navigate = useNavigate();

  return (
    <aside
      aria-label="Activity"
      style={{
        width: WebTokens.rightRailWidth,
        flexShrink: 0,
        alignSelf: 'flex-start',
        maxHeight: '100%',
        overflowY: 'auto',
        background: WebTokens.surface,
        borderLeft: `${WebTokens.borderWidth}px solid ${WebTokens.chromeDivider}`,
        padding: '14px 16px 16px',
      }}
    >
      <DailyBonusCard onClick={() => navigate(Routes.luckyWinners)} />

      <div style={{ height: 20 }} />

      <h2
        className="f-dmsans"
        style={{
          padding: '4px 6px 10px',
          color: WebTokens.textMuted,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 1.1,
        }}
      >
        RECENT ACTIVITY
      </h2>

      {summary == null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SkeletonCard height={56} />
          <SkeletonCard height={56} />
        </div>
      ) : summary.recent.length === 0 ? (
        <p style={{ padding: '0 6px', color: WebTokens.textMuted, fontSize: 12 }}>
          Points activity will show up here.
        </p>
      ) : (
        summary.recent.slice(0, 6).map((t) => <ActivityRow key={t.id} txn={t} />)
      )}
    </aside>
  );
}

/**
 * Daily Reward Pool teaser — real numbers, clickable straight into that page.
 * Mirrors the reference's "Daily Bonus" rail card slot exactly, with real data.
 * Neutral card: color lives in the icon/link only, not a gold-washed
 * background + border on the whole card.
 */
function DailyBonusCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        padding: 14,
        textAlign: 'left',
        background: WebTokens.surfaceAlt,
        borderRadius: WebTokens.radiusCard,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            padding: 8,
            display: 'inline-flex',
            background: withAlpha(WebTokens.gold, 0.2),
            borderRadius: 10,
            color: WebTokens.gold,
          }}
        >
          <AutoAwesomeRounded sx={{ fontSize: 18 }} />
        </span>
        <span style={{ color: WebTokens.textPrimary, fontWeight: 700, fontSize: 13.5 }}>
          Daily Bonus
        </span>
      </div>

      <p
        className="f-inter"
        style={{
          marginTop: 10,
          color: WebTokens.textSecondary,
          fontSize: 12,
          lineHeight: 1.35,
        }}
      >
        See who&apos;s leading today and where you rank.
      </p>

      <span
        style={{
          marginTop: 10,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          color: WebTokens.gold,
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        See today&apos;s winners
        <ArrowForwardRounded sx={{ fontSize: 14 }} />
      </span>
    </button>
  );
}
