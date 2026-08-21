import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BoltRounded from '@mui/icons-material/BoltRounded';
import CenterFocusStrongRounded from '@mui/icons-material/CenterFocusStrongRounded';
import LeaderboardOutlined from '@mui/icons-material/LeaderboardOutlined';
import LocalFireDepartmentOutlined from '@mui/icons-material/LocalFireDepartmentOutlined';
import LocalFireDepartmentRounded from '@mui/icons-material/LocalFireDepartmentRounded';
import LeaderboardRounded from '@mui/icons-material/LeaderboardRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import HourglassEmpty from '@mui/icons-material/HourglassEmpty';
import InsightsOutlined from '@mui/icons-material/InsightsOutlined';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import ArrowForward from '@mui/icons-material/ArrowForward';
import { Fmt } from '@/core/utils/format';
import { LeaderboardRepository } from '@/data/api/leaderboardRepository';
import { UserRepository, type TrendData } from '@/data/api/userRepository';
import { accuracyOf, initialsOf, type LeaderboardEntry } from '@/data/models';
import { Routes } from '@/router/routes';
import { useConfigStore } from '@/store/configStore';
import { usePredictionsStore } from '@/store/predictionsStore';
import { useUserStore } from '@/store/userStore';
import { WebTokens, cardShadow, glow, withAlpha } from '@/theme/webTokens';
import { ArenaCard } from '@/components/ArenaCard';
import { GhostButton } from '@/components/GhostButton';
import { GlowButton } from '@/components/GlowButton';
import { Sparkline } from '@/components/Sparkline';
import { CardGrid, Counter, Masthead, RailHeader, compactCounter } from '@/components/PageChrome';
import { EmptyState, StatusChip, WebAvatar, pagePadding } from '@/components/Primitives';
import { Reveal } from '@/components/Reveal';
import { SkeletonCard } from '@/components/Skeleton';
import { StatTile } from '@/components/StatTile';
import { WebCard } from '@/components/WebCard';
import { useCountUp } from '@/hooks/useCountUp';
import { useElementWidth } from '@/hooks/useElementWidth';
import { useWindowWidth } from '@/hooks/useWindowWidth';
import { showPredictionDetail } from '@/features/predictions/detailStore';

/**
 * Both Featured and Open challenges cap at this many cards on the dashboard —
 * matching the app's own Home section cap; "See all" (pre-filtered for
 * Featured) is where the rest live.
 */
const HOME_SECTION_CAP = 5;

/**
 * Portal dashboard (SOW: coin balance, active predictions, history entry
 * points, rewards summary, badges).
 *
 * Redesigned as a console layout: a slim masthead band with an inline live
 * strip, an asymmetric bento where Total points is the hero metric, and
 * rail-labelled sections whose cards flow in an auto-fill grid rather than at
 * fixed pixel widths. Every piece of data, action and empty state from the
 * previous layout is preserved — only the presentation changed.
 */
export function DashboardPage() {
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [topPredictors, setTopPredictors] = useState<LeaderboardEntry[]>([]);
  const [loadingTop, setLoadingTop] = useState(true);

  const user = useUserStore((s) => s.user);
  const open = usePredictionsStore((s) => s.open);
  const openTotal = usePredictionsStore((s) => s.openTotal);
  const loading = usePredictionsStore((s) => s.loading);

  const navigate = useNavigate();
  const width = useWindowWidth();

  /**
   * No loadOpen/loadActive here — WebShell already loads them once for the
   * whole portal session; calling them again would race the shell's own
   * in-flight call and could leave the feed stuck on its loading state.
   */
  useEffect(() => {
    UserRepository.trends()
      .then(setTrends)
      .catch(() => {
        /* tiles just render without deltas/sparklines */
      });

    LeaderboardRepository.leaderboard('daily')
      .then((data) => setTopPredictors(data.entries.slice(0, 3)))
      .catch(() => {
        /* peek shows its own empty state */
      })
      .finally(() => setLoadingTop(false));
  }, []);

  const firstLoad = loading && open.length === 0;

  /**
   * Up to HOME_SECTION_CAP admin-flagged featured picks, excluding predictions
   * the user has already answered — otherwise an answered pick kept showing in
   * Featured (still marked "Entered") since `open` isn't itself filtered by
   * answered state (PO-50).
   *
   * Deliberately no non-featured fallback: substituting a genuinely
   * non-featured prediction under the "Featured" heading reads as mislabeled
   * rather than helpful. The section's own empty state shows when there's
   * nothing real to feature.
   */
  const unanswered = open.filter((p) => p.selectedOptionId == null);
  const featured = unanswered.filter((p) => p.featured).slice(0, HOME_SECTION_CAP);
  const featuredIds = new Set(featured.map((p) => p.id));
  const openChallenges = unanswered
    .filter((p) => !featuredIds.has(p.id))
    .slice(0, HOME_SECTION_CAP);

  const padding = pagePadding(width);
  const players = open.reduce((s, x) => s + x.participants, 0);


  return (
    <div style={{ padding }}>
      {/* Cascading entrance — each section fades+slides in slightly after the
          one above it, so the page reads as one smooth reveal on load. */}
      <Reveal duration={350} y={0.05}>
        <Masthead
          eyebrow="LIVE ARENA"
          title="Make your call. Win the day."
          subtitle="New predictions drop daily — lock in your picks, climb the leaderboard, and earn points."
          actions={
            <>
              <GlowButton
                label="Predict now"
                icon={<BoltRounded />}
                height={46}
                onClick={() => navigate(Routes.predictions)}
              />
              <GhostButton
                label="Leaderboard"
                icon={<LeaderboardRounded />}
                onClick={() => navigate(Routes.leaderboard)}
              />
            </>
          }
          counters={[
            <Counter
              key="open"
              icon={<BoltRounded />}
              value={`${openTotal}`}
              label="Open now"
              tint={WebTokens.accent}
            />,
            <Counter
              key="players"
              icon={<GroupsRounded />}
              value={compactCounter(players)}
              label="Players in play"
              tint={WebTokens.blue}
            />,
            <Counter
              key="streak"
              icon={<LocalFireDepartmentRounded />}
              value={`${user.currentStreak}`}
              label="Your streak"
              tint={WebTokens.coral}
            />,
          ]}
        />
      </Reveal>

      <div style={{ height: 18 }} />

      {/* ---- Bento: one hero metric, then three supporting stats ---- */}
      <Reveal duration={320} y={0.08}>
        <PointsHeroTile
          coins={user.coins}
          delta={trends?.coinDelta}
          trend={trends?.coinTrend}
          rank={user.globalRank}
        />
      </Reveal>

      <div style={{ height: 16 }} />

      {/* auto-fit, so the three tiles either share a row or stack cleanly —
          never leaving a hole where a fourth tile would have gone. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(190px, 100%), 1fr))',
          gap: 16,
        }}
      >
        {[
          <StatTile
            key="accuracy"
            icon={<CenterFocusStrongRounded />}
            label="Accuracy"
            value={`${Math.round(accuracyOf(user) * 100)}%`}
            accent={WebTokens.accent}
            delta={trends?.accuracyDelta}
            sparkline={trends?.accuracyTrend}
          />,
          <StatTile
            key="rank"
            icon={<LeaderboardOutlined />}
            label="Global rank"
            value={user.globalRank > 0 ? `#${user.globalRank}` : '—'}
            countTo={user.globalRank > 0 ? user.globalRank : null}
            countFormatter={(v) => `#${Math.round(v)}`}
            accent={WebTokens.violet}
          />,
          <StatTile
            key="streak"
            icon={<LocalFireDepartmentOutlined />}
            label="Current streak"
            value={`${user.currentStreak}`}
            countTo={user.currentStreak}
            accent={WebTokens.coral}
          />,
        ].map((tile, i) => (
          <Reveal key={i} delay={60 * (i + 1)} duration={320} y={0.08}>
            {tile}
          </Reveal>
        ))}
      </div>

      <div style={{ height: 20 }} />

      {/* Lucky draw promo — only on viewports narrower than the right rail's
          breakpoint (the rail already carries this on wide desktop via its
          Daily Bonus card; showing both would duplicate). */}
      {width < WebTokens.bpWideRail && (
        <Reveal delay={220} duration={320}>
          <LuckyDrawBanner onClick={() => navigate(Routes.luckyWinners)} />
          <div style={{ height: 20 }} />
        </Reveal>
      )}

      {/* ---- Featured ---- */}
      <Reveal delay={260} duration={320}>
        <RailHeader
          title="Featured"
          caption="Hand-picked by the team"
          accent={WebTokens.gold}
          count={featured.length}
          actionLabel="See all"
          // Pre-filters the Predict page for Featured, same as the app.
          onAction={() => navigate(`${Routes.predictions}?show=featured`)}
        />
        {firstLoad ? (
          <CardGrid min={300}>
            <SkeletonCard height={220} />
            <SkeletonCard height={220} />
          </CardGrid>
        ) : featured.length > 0 ? (
          <CardGrid min={300}>
            {featured.map((p) => (
              <ArenaCard key={p.id} prediction={p} onOpenDetail={showPredictionDetail} />
            ))}
          </CardGrid>
        ) : (
          <WebCard>
            <EmptyState
              icon={<HourglassEmpty sx={{ fontSize: 30 }} />}
              title="Nothing open right now"
              subtitle="New predictions drop daily — check back soon."
            />
          </WebCard>
        )}
      </Reveal>

      <div style={{ height: 26 }} />

      {/* ---- Top predictors (mirrors the app's Home leaderboard peek) ---- */}
      <Reveal delay={320} duration={320}>
        <RailHeader
          title="Top predictors"
          caption="Today's leaders"
          accent={WebTokens.violet}
          actionLabel="Leaderboard"
          onAction={() => navigate(Routes.leaderboard)}
        />
        {loadingTop ? (
          <SkeletonCard height={140} />
        ) : (
          <LeaderboardPeek
            entries={topPredictors}
            onClick={() => navigate(Routes.leaderboard)}
          />
        )}
      </Reveal>

      <div style={{ height: 26 }} />

      {/* ---- Open challenges ---- */}
      <Reveal delay={380} duration={320}>
        <RailHeader
          title="Open challenges"
          caption="Still taking picks"
          accent={WebTokens.accent}
          count={openTotal}
          actionLabel="See all"
          onAction={() => navigate(Routes.predictions)}
        />
        {firstLoad ? (
          <CardGrid min={240}>
            <SkeletonCard height={220} />
            <SkeletonCard height={220} />
          </CardGrid>
        ) : openChallenges.length === 0 ? (
          <WebCard>
            <EmptyState
              icon={<InsightsOutlined sx={{ fontSize: 30 }} />}
              title="No more open challenges"
              subtitle="Check back soon for new predictions."
            />
          </WebCard>
        ) : (
          <CardGrid min={240}>
            {openChallenges.map((p, i) => (
              <Reveal key={p.id} delay={60 * i} duration={320} y={0.08}>
                <ArenaCard prediction={p} onOpenDetail={showPredictionDetail} />
              </Reveal>
            ))}
          </CardGrid>
        )}
      </Reveal>
    </div>
  );
}

/**
 * The bento's hero metric: total points at display scale, with its trend line
 * filling the card rather than sitting as a thumbnail beside the number.
 *
 * Deliberately not a StatTile — that shape is what the three supporting tiles
 * use, and the point of the asymmetric grid is that this one reads differently.
 */
function PointsHeroTile({
  coins,
  delta,
  trend,
  rank,
}: {
  coins: number;
  delta?: number | null;
  trend?: number[] | null;
  rank: number;
}) {
  const counted = useCountUp(coins, 900, true);
  const up = (delta ?? 0) >= 0;
  // Sparkline draws at fixed pixel dimensions, so the card measures itself
  // rather than assuming a width that would leave the line short of the edge.
  const [cardRef, cardWidth] = useElementWidth();

  return (
    <WebCard padding={0} hoverLift accentBorder={withAlpha(WebTokens.gold, 0.3)}>
      <div
        ref={cardRef}
        style={{ position: 'relative', overflow: 'hidden', borderRadius: WebTokens.radiusCard }}
      >
        <div style={{ position: 'relative', padding: '20px 22px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                padding: 9,
                display: 'inline-flex',
                background: `linear-gradient(135deg, ${withAlpha(WebTokens.gold, 0.24)}, ${withAlpha(WebTokens.gold, 0.08)})`,
                borderRadius: 11,
                border: `1px solid ${withAlpha(WebTokens.gold, 0.28)}`,
                color: WebTokens.gold,
                fontSize: 18,
              }}
            >
              <BoltRounded />
            </span>
            <span style={{ flex: 1, color: WebTokens.textSecondary, fontSize: 13, fontWeight: 500 }}>
              Total points
            </span>
            {delta != null && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 9px',
                  background: withAlpha(up ? WebTokens.accent : WebTokens.danger, 0.13),
                  borderRadius: 999,
                  color: up ? WebTokens.accent : WebTokens.danger,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {up ? '▲' : '▼'} {Math.abs(delta)}
              </span>
            )}
          </div>

          <div style={{ marginTop: 14, display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span
              className="f-opensans"
              style={{
                fontSize: 42,
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: -1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {Fmt.compactNumber(Math.round(counted))}
            </span>
            {rank > 0 && (
              <span style={{ color: WebTokens.textMuted, fontSize: 12.5 }}>
                rank #{rank} globally
              </span>
            )}
          </div>
        </div>

        {/* Full-bleed trend line along the bottom edge. */}
        {trend && trend.length > 1 && cardWidth > 0 ? (
          <div style={{ marginTop: 12, display: 'flex' }}>
            <Sparkline values={trend} color={WebTokens.gold} width={cardWidth} height={64} />
          </div>
        ) : (
          <div style={{ height: 22 }} />
        )}
      </div>
    </WebCard>
  );
}

/**
 * Compact top-3 leaderboard peek — the web equivalent of the mobile app's Home
 * `_LeaderboardPeek`/`_PeekRow` (rank medal, avatar, name, accuracy, coins).
 *
 * Now a podium: rank 1 gets a taller, tinted row so the leader is legible at a
 * glance instead of three identical lines.
 */
function LeaderboardPeek({
  entries,
  onClick,
}: {
  entries: LeaderboardEntry[];
  onClick: () => void;
}) {
  if (entries.length === 0) {
    return (
      <WebCard>
        <EmptyState
          icon={<LeaderboardOutlined sx={{ fontSize: 30 }} />}
          title="Rankings update as predictions resolve."
        />
      </WebCard>
    );
  }

  return (
    <WebCard hoverLift onClick={onClick} padding={10}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {entries.map((e) => (
          <PeekRow key={`${e.rank}-${e.username}`} entry={e} />
        ))}
      </div>
    </WebCard>
  );
}

function PeekRow({ entry }: { entry: LeaderboardEntry }) {
  const medal =
    entry.rank === 1 ? WebTokens.gold : entry.rank === 2 ? WebTokens.blue : WebTokens.violet;
  const leader = entry.rank === 1;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: leader ? '11px 12px' : '8px 12px',
        background: leader ? withAlpha(medal, 0.08) : 'transparent',
        border: `1px solid ${leader ? withAlpha(medal, 0.24) : 'transparent'}`,
        borderRadius: WebTokens.radiusControl,
      }}
    >
      <span
        className="f-opensans"
        style={{
          width: 26,
          height: 26,
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 9,
          background: withAlpha(medal, 0.18),
          border: `1px solid ${withAlpha(medal, 0.32)}`,
          color: medal,
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {entry.rank}
      </span>
      <WebAvatar
        initials={entry.name.length === 0 ? '?' : initialsOf(entry.name)[0]}
        seed={entry.seed}
        radius={leader ? 17 : 15}
      />
      <span
        className="ellipsis"
        style={{ flex: 1, fontWeight: 600, fontSize: leader ? 14 : 13 }}
      >
        {entry.name}
      </span>
      <span style={{ color: WebTokens.textMuted, fontSize: 12 }}>
        {Math.round(entry.accuracy * 100)}%
      </span>
      <span
        className="f-opensans"
        style={{
          marginLeft: 14,
          color: WebTokens.gold,
          fontWeight: 700,
          fontSize: 12.5,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {Fmt.compactNumber(entry.coins)}
      </span>
    </div>
  );
}

/** Gold→violet gradient banner mirroring the mobile app's lucky-draw strip. */
function LuckyDrawBanner({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  const config = useConfigStore((s) => s.config);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        width: '100%',
        padding: '16px 20px',
        textAlign: 'left',
        background: 'linear-gradient(100deg, #43310E, #3A1F17, #2A1B3D)',
        borderRadius: WebTokens.radiusCard,
        border: `1px solid ${withAlpha(WebTokens.gold, 0.4)}`,
        boxShadow: hover ? glow(WebTokens.gold, 0.3) : cardShadow,
        transform: hover ? 'translateY(-3px)' : 'none',
        transition: 'transform 170ms ease, box-shadow 170ms ease',
      }}
    >
      <span
        style={{
          padding: 10,
          flexShrink: 0,
          display: 'inline-flex',
          background: `linear-gradient(135deg, ${WebTokens.gold}, ${WebTokens.goldDeep})`,
          borderRadius: 12,
          boxShadow: glow(WebTokens.gold, 0.4),
          color: WebTokens.onAccent,
        }}
      >
        <AutoAwesome sx={{ fontSize: 20 }} />
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="t-title-large" style={{ fontSize: 16 }}>
            {config.luckyDrawLabel}
          </span>
          <StatusChip label="LIVE" color={WebTokens.accent} />
        </span>
        <span
          className="clamp-2"
          style={{
            marginTop: 3,
            display: 'block',
            color: WebTokens.textSecondary,
            fontSize: 12.5,
          }}
        >
          {config.luckyDrawTagline}
        </span>
      </span>

      {/* Visual-only pill — the whole banner already is one target. */}
      <span
        style={{
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '11px 15px',
          background: `linear-gradient(135deg, ${WebTokens.gold}, ${WebTokens.goldDeep})`,
          borderRadius: WebTokens.radiusControl,
          boxShadow: glow(WebTokens.gold, 0.35),
          color: WebTokens.onAccent,
          fontWeight: 400,
          fontSize: 13,
        }}
      >
        Predict now
        <ArrowForward sx={{ fontSize: 15 }} />
      </span>
    </button>
  );
}
