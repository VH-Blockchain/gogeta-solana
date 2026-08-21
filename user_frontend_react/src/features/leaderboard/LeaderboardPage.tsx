import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BoltRounded from '@mui/icons-material/BoltRounded';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import PersonPinCircleRounded from '@mui/icons-material/PersonPinCircleRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import TrackChangesRounded from '@mui/icons-material/TrackChangesRounded';
import TrendingUpRounded from '@mui/icons-material/TrendingUpRounded';
import ArrowForward from '@mui/icons-material/ArrowForward';
import WifiOff from '@mui/icons-material/WifiOff';
import EmojiEventsOutlined from '@mui/icons-material/EmojiEventsOutlined';
import { badgeLabel } from '@/core/constants/economy';
import { Fmt } from '@/core/utils/format';
import { LeaderboardRepository, type LeaderboardData } from '@/data/api/leaderboardRepository';
import { initialsOf, type LeaderboardEntry } from '@/data/models';
import { Routes } from '@/router/routes';
import { useConfigStore } from '@/store/configStore';
import { useUserStore } from '@/store/userStore';
import { WebTokens, alphaBlend, glow, withAlpha } from '@/theme/webTokens';
import {
  EmptyState,
  HeaderStat,
  PageHeader,
  StatusChip,
  WebAvatar,
  pagePadding,
} from '@/components/Primitives';
import { Reveal } from '@/components/Reveal';
import { SkeletonList } from '@/components/Skeleton';
import { WebCard } from '@/components/WebCard';
import { useWindowWidth } from '@/hooks/useWindowWidth';
import { CrownIcon } from './CrownIcon';

const PERIODS = ['daily', 'weekly', 'monthly'] as const;
const PERIOD_LABELS = ['Daily', 'Weekly', 'Monthly'];
const CAPTIONS = ["Top movers today", "This week's climbers", 'Monthly champions'];

/**
 * Leaderboard module (SOW: daily/weekly/monthly; rank, username, badge, score,
 * accuracy%). Port of `WebLeaderboardPage`.
 */
export function LeaderboardPage() {
  const [period, setPeriod] = useState(0);
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const luckyDrawLabel = useConfigStore((s) => s.config.luckyDrawLabel);
  const navigate = useNavigate();
  const width = useWindowWidth();
  const padding = pagePadding(width);
  const narrow = width < WebTokens.bpTablet;

  const load = useCallback(async (index: number) => {
    setData(null);
    setError(null);
    try {
      setData(await LeaderboardRepository.leaderboard(PERIODS[index]));
    } catch {
      setError('Could not load the leaderboard.');
    }
  }, []);

  useEffect(() => {
    void load(period);
  }, [period, load]);

  const stats =
    data == null
      ? null
      : [
          ...(data.me
            ? [
                <HeaderStat
                  key="rank"
                  icon={<PersonPinCircleRounded sx={{ fontSize: 15 }} />}
                  value={`#${data.me.rank}`}
                  label="your rank"
                  tint={WebTokens.violet}
                />,
              ]
            : []),
          <HeaderStat
            key="ranked"
            icon={<GroupsRounded sx={{ fontSize: 15 }} />}
            value={`${data.entries.length}`}
            label="ranked players"
            tint={WebTokens.blue}
          />,
          ...(data.me
            ? [
                <HeaderStat
                  key="acc"
                  icon={<TrackChangesRounded sx={{ fontSize: 15 }} />}
                  value={`${Math.round(data.me.accuracy * 100)}%`}
                  label="your accuracy"
                  tint={WebTokens.accent}
                />,
              ]
            : []),
        ];

  return (
    <div style={{ padding }}>
      <PageHeader
        title="Leaderboard"
        subtitle="Who's calling it best — ranked by score and accuracy."
        narrow={narrow}
        stats={stats}
        trailing={
          <div
            role="tablist"
            style={{
              display: 'inline-flex',
              padding: 4,
              background: WebTokens.surfaceAlt,
              borderRadius: 999,
              border: `1px solid ${WebTokens.border}`,
            }}
          >
            {PERIOD_LABELS.map((label, i) => (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={i === period}
                onClick={() => setPeriod(i)}
                style={{
                  // Vertical padding tuned so the target clears the ~40px
                  // accessible-minimum touch size.
                  padding: '13px 16px',
                  borderRadius: 999,
                  background: i === period ? WebTokens.violet : 'transparent',
                  color: i === period ? '#FFFFFF' : WebTokens.textSecondary,
                  fontSize: 13,
                  fontWeight: 600,
                  transition: 'background 160ms ease, color 160ms ease',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      <div style={{ height: 14 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <BoltRounded sx={{ fontSize: 13 }} style={{ color: WebTokens.violet }} />
        <span style={{ color: WebTokens.textSecondary, fontSize: 12.5, fontWeight: 600 }}>
          {CAPTIONS[period]}
        </span>
        <span style={{ flex: 1 }} />
        <StatusChip label={resetLabel(period)} color={WebTokens.violet} />
        <button
          type="button"
          onClick={() => navigate(Routes.luckyWinners)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 4px',
            color: WebTokens.gold,
            fontSize: 12.5,
            fontWeight: 700,
          }}
        >
          <AutoAwesomeRounded sx={{ fontSize: 14 }} />
          {luckyDrawLabel}
        </button>
      </div>

      <div style={{ height: 18 }} />

      <Reveal delay={80} duration={320}>
        <ClimbRanksBanner onClick={() => navigate(Routes.predictions)} />
      </Reveal>

      <div style={{ height: 24 }} />

      <div
        key={`${period}-${error != null}-${data == null}-${data?.entries.length}`}
        className="reveal"
        style={{ ['--reveal-y' as string]: '2%', ['--reveal-duration' as string]: '260ms' }}
      >
        {error != null ? (
          <WebCard>
            <EmptyState
              icon={<WifiOff sx={{ fontSize: 30 }} />}
              title={error}
              action={
                <button type="button" className="btn-outlined" onClick={() => load(period)}>
                  Retry
                </button>
              }
            />
          </WebCard>
        ) : data == null ? (
          <SkeletonList count={3} height={60} />
        ) : data.entries.length === 0 ? (
          <WebCard>
            <EmptyState
              icon={<EmojiEventsOutlined sx={{ fontSize: 30 }} />}
              title="No rankings yet"
              subtitle="Rankings appear once predictions are resolved for this period."
            />
          </WebCard>
        ) : (
          <div>
            {/* Top 3 elevated podium — rank 1 centered and tallest, ranks 2/3
                flanking at equal shorter height (crown + stepped pillar
                blocks, not three equal side-by-side cards). */}
            {data.entries.length >= 3 && (
              <Reveal duration={340} y={0.08}>
                <WebCard>
                  <PodiumRow top3={data.entries.slice(0, 3)} />
                </WebCard>
              </Reveal>
            )}

            <div style={{ height: 24 }} />

            <WebCard padding={0}>
              <TableHeader showBadges={!narrow} />
              <div className="divider" />
              {data.entries.slice(data.entries.length >= 3 ? 3 : 0).map((e, i, arr) => (
                <div key={`${e.rank}-${e.username}`}>
                  <LeaderRow entry={e} showBadges={!narrow} />
                  {i < arr.length - 1 && <div className="divider" />}
                </div>
              ))}
            </WebCard>

            {data.me != null && !data.entries.some((e) => e.isCurrentUser) && (
              <div style={{ marginTop: 16 }}>
                <WebCard padding={0} accentBorder={withAlpha(WebTokens.accent, 0.5)}>
                  <LeaderRow entry={data.me} showBadges={!narrow} pinned />
                </WebCard>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Live countdown to the next period boundary — mirrors the app's
 * `leaderboard_screen.dart` `_resetLabel` exactly (daily -> midnight,
 * weekly -> next Monday, monthly -> 1st of next month).
 */
function resetLabel(period: number): string {
  const now = new Date();
  let next: Date;
  if (period === 1) {
    const MONDAY = 1;
    const daysToMon = (MONDAY - now.getDay() + 7) % 7;
    next = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    next.setDate(next.getDate() + (daysToMon === 0 ? 7 : daysToMon));
  } else if (period === 2) {
    next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  } else {
    next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  }
  const ms = next.getTime() - now.getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `Resets in ${days}d`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `Resets in ${hours}h`;
  return `Resets in ${Math.floor(ms / 60_000)}m`;
}

/** Backend usernames already carry a leading '@' — avoid doubling it. */
export function atHandle(username: string): string {
  return username.startsWith('@') ? username : `@${username}`;
}

/**
 * Ties the leaderboard back into the core loop: climbing ranks requires making
 * (and winning) predictions. The same visual language as the dashboard's Lucky
 * Draw banner, violet-tinted instead of gold.
 */
function ClimbRanksBanner({ onClick }: { onClick: () => void }) {
  const user = useUserStore((s) => s.user);
  return (
    <WebCard hoverLift onClick={onClick} glow={WebTokens.violet}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span
          style={{
            padding: 10,
            flexShrink: 0,
            display: 'inline-flex',
            background: `linear-gradient(135deg, ${WebTokens.violet}, #B06AFF)`,
            borderRadius: 12,
            boxShadow: glow(WebTokens.violet, 0.35),
            color: '#FFFFFF',
          }}
        >
          <TrendingUpRounded sx={{ fontSize: 20 }} />
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t-title-large" style={{ fontSize: 16 }}>
            {user.globalRank > 0 ? `You're #${user.globalRank} globally` : 'Not ranked yet'}
          </div>
          <div
            className="ellipsis"
            style={{ marginTop: 3, color: WebTokens.textSecondary, fontSize: 13 }}
          >
            Every correct call moves you up — make a prediction to climb.
          </div>
        </div>

        <span
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '12px 16px',
            background: `linear-gradient(135deg, ${WebTokens.violet}, #B06AFF)`,
            borderRadius: WebTokens.radiusControl,
            color: '#FFFFFF',
            fontWeight: 400,
            fontSize: 13.5,
          }}
        >
          Predict now
          <ArrowForward sx={{ fontSize: 15 }} />
        </span>
      </div>
    </WebCard>
  );
}

/**
 * Elevated 3-pillar podium (crown above each avatar, rank-1 centered and
 * tallest, ranks 2/3 flanking at equal shorter height) — an actual stepped
 * podium read instead of three equal side-by-side cards.
 */
function PodiumRow({ top3 }: { top3: LeaderboardEntry[] }) {
  const byRank = new Map(top3.map((e) => [e.rank, e]));

  return (
    <div style={{ position: 'relative' }}>
      {/* Soft ambient glow behind the podium — a gold-tinted radial wash
          centered behind rank 1, purely decorative. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 220,
          height: 160,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${withAlpha(WebTokens.gold, 0.16)}, ${withAlpha(WebTokens.gold, 0)})`,
        }}
      />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        {byRank.get(2) && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <PodiumPillar entry={byRank.get(2)!} pillarHeight={78} />
          </div>
        )}
        {byRank.get(1) && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <PodiumPillar entry={byRank.get(1)!} pillarHeight={132} emphasize />
          </div>
        )}
        {byRank.get(3) && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <PodiumPillar entry={byRank.get(3)!} pillarHeight={78} />
          </div>
        )}
      </div>
    </div>
  );
}

// Gold center, the portal's own brand green for both flanking spots — matches
// the reference exactly (gold #1, green #2/#3, not gold/silver/bronze) while
// using *this app's* accent green rather than a borrowed hue.
const MEDALS = [WebTokens.gold, WebTokens.accent, WebTokens.accent];

function PodiumPillar({
  entry: e,
  pillarHeight,
  emphasize = false,
}: {
  entry: LeaderboardEntry;
  pillarHeight: number;
  emphasize?: boolean;
}) {
  const medal = MEDALS[Math.min(Math.max(e.rank - 1, 0), 2)];
  // The avatar ring stays the same green for every podium spot — only the
  // crown/rank-badge/pillar carry the gold-for-1st distinction. "This is you"
  // gets gold instead, as a separate, still-meaningful signal.
  const ringColor = e.isCurrentUser ? WebTokens.gold : WebTokens.accent;

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Soft vertical spotlight behind this column — brightest around the
          avatar, fading out both up past the crown and down into the pillar. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: emphasize ? 10 : 6,
          left: '50%',
          transform: 'translateX(-50%)',
          width: emphasize ? 96 : 70,
          height: emphasize ? 156 : 116,
          borderRadius: 999,
          background:
            'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.12) 32%, rgba(255,255,255,0.05) 70%, rgba(255,255,255,0) 100%)',
        }}
      />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <CrownIcon color={medal} size={emphasize ? 30 : 22} />

        <div
          style={{
            marginTop: 6,
            padding: 3,
            borderRadius: '50%',
            border: `2.5px solid ${ringColor}`,
            boxShadow: glow(ringColor, 0.35),
          }}
        >
          <WebAvatar initials={initialsOf(e.name)} seed={e.seed} radius={emphasize ? 30 : 23} />
        </div>

        <div
          className="ellipsis"
          style={{
            marginTop: 8,
            width: '100%',
            textAlign: 'center',
            fontWeight: 700,
            fontSize: emphasize ? 14 : 12.5,
          }}
        >
          {e.name}
        </div>

        {/* Rank badge sits directly above the pillar — a clean gap, rather than
            straddling the pillar's rounded top corners (which clipped
            unpredictably at some ranks/widths). */}
        <div
          style={{
            marginTop: 10,
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: medal,
            border: `2px solid ${WebTokens.surface}`,
            color: WebTokens.onAccent,
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {e.rank}
        </div>

        <div
          style={{
            marginTop: 8,
            width: '100%',
            height: pillarHeight,
            paddingTop: 14,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            // Vivid, near-solid fill (the reference's pedestal blocks read as
            // solid color, not a faint tinted wash) — darkening toward the
            // bottom for a touch of depth.
            background: `linear-gradient(to bottom, ${alphaBlend(medal, 0.55, WebTokens.surface)}, ${alphaBlend(medal, 0.3, WebTokens.surface)})`,
            borderRadius: '14px 14px 0 0',
            border: `1px solid ${withAlpha(medal, 0.4)}`,
          }}
        >
          <span
            className="f-opensans"
            style={{
              fontWeight: 700,
              fontSize: emphasize ? 16 : 14,
              color: WebTokens.textPrimary,
            }}
          >
            {Fmt.compactNumber(e.coins)}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>pts</span>
        </div>
      </div>
    </div>
  );
}

const HEADER_STYLE: React.CSSProperties = {
  color: WebTokens.textMuted,
  fontSize: 12,
  fontWeight: 600,
};

function TableHeader({ showBadges }: { showBadges: boolean }) {
  return (
    <div
      className="f-dmsans"
      style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', gap: 0 }}
    >
      <span style={{ ...HEADER_STYLE, width: showBadges ? 44 : 36, flexShrink: 0 }}>RANK</span>
      <span style={{ ...HEADER_STYLE, flex: 1, minWidth: 0 }}>PLAYER</span>
      {showBadges && <span style={{ ...HEADER_STYLE, width: 130, flexShrink: 0 }}>BADGE</span>}
      <span
        style={{ ...HEADER_STYLE, width: showBadges ? 80 : 62, flexShrink: 0, textAlign: 'right' }}
      >
        POINTS
      </span>
      <span
        style={{ ...HEADER_STYLE, width: showBadges ? 90 : 58, flexShrink: 0, textAlign: 'right' }}
      >
        {showBadges ? 'ACCURACY' : 'ACC'}
      </span>
    </div>
  );
}

function LeaderRow({
  entry: e,
  showBadges,
  pinned = false,
}: {
  entry: LeaderboardEntry;
  showBadges: boolean;
  pinned?: boolean;
}) {
  const highlight = e.isCurrentUser || pinned;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 20px',
        gap: 0,
        background: highlight ? withAlpha(WebTokens.accent, 0.06) : 'transparent',
      }}
    >
      <span style={{ width: showBadges ? 44 : 36, flexShrink: 0 }}>
        <span
          style={{
            width: 26,
            height: 26,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: highlight ? withAlpha(WebTokens.accent, 0.14) : WebTokens.surfaceAlt,
            border: highlight ? `1px solid ${withAlpha(WebTokens.accent, 0.4)}` : 'none',
            color: highlight ? WebTokens.accent : WebTokens.textSecondary,
            fontSize: 11.5,
            fontWeight: 800,
          }}
        >
          {e.rank > 0 ? e.rank : '—'}
        </span>
      </span>

      <WebAvatar initials={initialsOf(e.name)} seed={e.seed} radius={15} />

      <div style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
        <div className="ellipsis" style={{ fontWeight: 700 }}>
          {highlight ? `${e.name} (you)` : e.name}
        </div>
        <div className="ellipsis" style={{ color: WebTokens.textMuted, fontSize: 12 }}>
          {atHandle(e.username)}
        </div>
        {/* Below the tablet breakpoint the badge column is gone — fold the
            badge in here instead of dropping it silently. */}
        {!showBadges && (
          <div style={{ marginTop: 4 }}>
            <StatusChip label={badgeLabel[e.topBadge]} color={WebTokens.violet} />
          </div>
        )}
      </div>

      {showBadges && (
        <span style={{ width: 130, flexShrink: 0 }}>
          <StatusChip label={badgeLabel[e.topBadge]} color={WebTokens.violet} />
        </span>
      )}

      <span
        style={{
          width: showBadges ? 80 : 62,
          flexShrink: 0,
          textAlign: 'right',
          fontWeight: 700,
        }}
      >
        {Fmt.compactNumber(e.coins)}
      </span>
      <span
        style={{
          width: showBadges ? 90 : 58,
          flexShrink: 0,
          textAlign: 'right',
          color: WebTokens.textSecondary,
          fontWeight: 500,
        }}
      >
        {Math.round(e.accuracy * 100)}%
      </span>
    </div>
  );
}
