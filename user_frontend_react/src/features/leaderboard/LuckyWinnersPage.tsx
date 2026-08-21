import { useCallback, useEffect, useState } from 'react';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import VerifiedUserRounded from '@mui/icons-material/VerifiedUserRounded';
import EmojiEventsRounded from '@mui/icons-material/EmojiEventsRounded';
import InfoOutlineRounded from '@mui/icons-material/InfoOutlined';
import HourglassEmptyRounded from '@mui/icons-material/HourglassEmptyRounded';
import WifiOff from '@mui/icons-material/WifiOff';
import Refresh from '@mui/icons-material/Refresh';
import { LeaderboardRepository } from '@/data/api/leaderboardRepository';
import { initialsOf, type LeaderboardEntry } from '@/data/models';
import { useConfigStore } from '@/store/configStore';
import { AppGradients } from '@/theme/gradients';
import { WebTokens, withAlpha } from '@/theme/webTokens';
import { ConfettiBurst } from '@/components/Confetti';
import {
  CoinAmount,
  EmptyState,
  PageHeader,
  SectionHeader,
  StatusChip,
  WebAvatar,
  pagePadding,
} from '@/components/Primitives';
import { Reveal } from '@/components/Reveal';
import { SkeletonList } from '@/components/Skeleton';
import { WebCard } from '@/components/WebCard';
import { useWindowWidth } from '@/hooks/useWindowWidth';
import { atHandle } from './LeaderboardPage';

const CONFETTI_COLORS = [WebTokens.gold, WebTokens.violet, WebTokens.accent];

/**
 * Daily Reward Pool + today's lucky winners — the web equivalent of the app's
 * `lucky_winners_screen.dart`. Port of `WebLuckyWinnersPage`.
 */
export function LuckyWinnersPage() {
  const [winners, setWinners] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const config = useConfigStore((s) => s.config);
  const width = useWindowWidth();
  const padding = pagePadding(width);

  const load = useCallback(async () => {
    setError(null);
    try {
      setWinners(await LeaderboardRepository.luckyWinnersToday());
    } catch {
      setError('Could not load the daily draw.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const didWin = winners?.some((w) => w.isCurrentUser) ?? false;

  return (
    <div style={{ position: 'relative' }}>
      {/* Subtle celebratory burst over the hero when the user won — mirrors the
          app exactly (the same confetti component, no web reimplementation). */}
      {didWin && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 260,
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          <ConfettiBurst count={70} colors={CONFETTI_COLORS} />
        </div>
      )}

      <div style={{ padding, position: 'relative' }}>
        <PageHeader
          title={config.luckyDrawLabel}
          subtitle={config.luckyDrawTagline}
          narrow={width < WebTokens.bpTablet}
        />

        <div style={{ height: 20 }} />

        <Reveal duration={340} y={0.05}>
          <PoolHero label={config.luckyDrawLabel} />
        </Reveal>

        <div style={{ height: 28 }} />

        <SectionHeader title="Today's winners" />

        <div
          key={`${winners == null}-${error != null}-${winners?.length}`}
          className="reveal"
          style={{ ['--reveal-y' as string]: '2%', ['--reveal-duration' as string]: '260ms' }}
        >
          {error != null && winners == null ? (
            <WebCard>
              <EmptyState
                icon={<WifiOff sx={{ fontSize: 30 }} />}
                title={error}
                action={
                  <button type="button" className="btn-outlined" onClick={load}>
                    <Refresh sx={{ fontSize: 18 }} />
                    Retry
                  </button>
                }
              />
            </WebCard>
          ) : winners == null ? (
            <SkeletonList count={3} height={60} />
          ) : winners.length === 0 ? (
            <WebCard>
              <EmptyState
                icon={<HourglassEmptyRounded sx={{ fontSize: 30 }} />}
                title="No winners yet"
                subtitle="Today's lucky draw hasn't been drawn yet. Check back later!"
              />
            </WebCard>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {winners.map((w, i) => (
                <Reveal key={`${w.rank}-${w.username}`} delay={60 * i} duration={300} y={0.05}>
                  <WinnerRow entry={w} />
                </Reveal>
              ))}
            </div>
          )}
        </div>

        <div style={{ height: 24 }} />

        <Reveal delay={120} duration={320}>
          <StatusCard didWin={didWin} />
        </Reveal>
      </div>
    </div>
  );
}

/**
 * Hero card explaining the daily reward pool — the same copy + gradient as the
 * app's own `_PoolHero` (AppGradients.lucky).
 */
function PoolHero({ label }: { label: string }) {
  // Read from /config rather than the bundled Economy constants: these amounts
  // are admin-editable, so a hard-coded copy goes stale the moment one changes.
  const dailyLuckyWinners = useConfigStore((s) => s.config.economy.dailyLuckyWinners);
  return (
    <div
      style={{
        padding: 20,
        background: AppGradients.lucky,
        borderRadius: WebTokens.radiusCard,
        boxShadow: '0 8px 22px -8px rgba(255,122,77,0.28)',
        color: '#FFFFFF',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span
          style={{
            width: 48,
            height: 48,
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: 14,
          }}
        >
          <AutoAwesomeRounded sx={{ fontSize: 26 }} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{label}</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12.5 }}>
            Resets every midnight
          </div>
        </div>
      </div>

      <div style={{ height: 18 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <GroupsRounded sx={{ fontSize: 18 }} />
        <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>
          {dailyLuckyWinners} top predictors are featured here every day
        </span>
      </div>

      <div style={{ height: 8 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <VerifiedUserRounded sx={{ fontSize: 18 }} />
        <span style={{ flex: 1, color: 'rgba(255,255,255,0.7)', fontSize: 12.5 }}>
          Transparent &amp; auditable selection
        </span>
      </div>
    </div>
  );
}

/** A single winner row: icon, avatar, name, "You won!" pill, +coins. */
function WinnerRow({ entry }: { entry: LeaderboardEntry }) {
  const mine = entry.isCurrentUser;
  return (
    <WebCard
      padding="14px 16px"
      accentBorder={mine ? withAlpha(WebTokens.violet, 0.55) : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <AutoAwesomeRounded sx={{ fontSize: 18 }} style={{ color: WebTokens.gold }} />
        <WebAvatar initials={initialsOf(entry.name)} seed={entry.seed} radius={19} />
        <div style={{ flex: 1, minWidth: 0, marginLeft: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="ellipsis" style={{ fontWeight: 700, fontSize: 14 }}>
              {mine ? 'You' : entry.name}
            </span>
            {mine && <StatusChip label="You won!" color={WebTokens.violet} />}
          </div>
          <div
            className="ellipsis"
            style={{ marginTop: 2, color: WebTokens.textMuted, fontSize: 12 }}
          >
            {atHandle(entry.username)}
          </div>
        </div>
        <CoinAmount amount={entry.coins} fontSize={14} />
      </div>
    </WebCard>
  );
}

/** Current-user status summary at the bottom — matches the app's copy. */
function StatusCard({ didWin }: { didWin: boolean }) {
  const luckyBonus = useConfigStore((s) => s.config.economy.luckyBonus);
  return (
    <WebCard glow={WebTokens.gold}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span
          style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: withAlpha(WebTokens.gold, 0.14),
            borderRadius: 12,
            color: WebTokens.gold,
          }}
        >
          <EmojiEventsRounded sx={{ fontSize: 22 }} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: WebTokens.textSecondary, fontSize: 12.5 }}>Your status</div>
          <div style={{ marginTop: 2, fontWeight: 700, fontSize: 14.5 }}>
            {didWin
              ? `You bagged ${luckyBonus} bonus points today 🎉`
              : 'Not selected today — keep predicting!'}
          </div>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: 12,
          background: WebTokens.surfaceAlt,
          borderRadius: WebTokens.radiusControl,
          border: `1px solid ${WebTokens.border}`,
        }}
      >
        <InfoOutlineRounded sx={{ fontSize: 16 }} style={{ color: WebTokens.textMuted }} />
        <span style={{ flex: 1, color: WebTokens.textSecondary, fontSize: 12.5 }}>
          Must have at least one correct prediction to qualify.
        </span>
      </div>
    </WebCard>
  );
}
