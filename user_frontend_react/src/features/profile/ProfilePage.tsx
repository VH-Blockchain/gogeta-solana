import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import CenterFocusStrongRounded from '@mui/icons-material/CenterFocusStrongRounded';
import LocalFireDepartmentRounded from '@mui/icons-material/LocalFireDepartmentRounded';
import Public from '@mui/icons-material/Public';
import StackedBarChart from '@mui/icons-material/StackedBarChart';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import MilitaryTechOutlined from '@mui/icons-material/MilitaryTechOutlined';
import NotificationsActive from '@mui/icons-material/NotificationsActive';
import NotificationsActiveOutlined from '@mui/icons-material/NotificationsActiveOutlined';
import NotificationsOffOutlined from '@mui/icons-material/NotificationsOffOutlined';
import LockOutlineRounded from '@mui/icons-material/LockOutlined';
import Logout from '@mui/icons-material/Logout';
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import VisibilityRounded from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRounded from '@mui/icons-material/VisibilityOffRounded';
import {
  USER_LEVELS,
  levelLabel,
  nextLevel,
  nextLevelProgressDisplay,
} from '@/core/constants/economy';
import { performWebLogout } from '@/core/push/logout';
import { PushNotifications, type AuthorizationStatus } from '@/core/push/pushNotifications';
import { registerPushToken } from '@/core/push/pushRegistration';
import { Fmt } from '@/core/utils/format';
import { RewardsRepository, type RewardsSummary } from '@/data/api/rewardsRepository';
import { UserRepository } from '@/data/api/userRepository';
import { accuracyOf, earnedBadges, initialsOf } from '@/data/models';
import { Routes } from '@/router/routes';
import { useAuthStore } from '@/store/authStore';
import { useUserStore } from '@/store/userStore';
import { WebTokens, withAlpha } from '@/theme/webTokens';
import { ActivityRow } from '@/components/ActivityRow';
import { BadgeMedallion } from '@/components/BadgeMedallion';
import { HScrollArrows } from '@/components/HScrollArrows';
import { LevelPath } from '@/components/LevelPath';
import { AlertDialogCard, Modal } from '@/components/Modal';
import {
  EmptyState,
  SectionHeader,
  StatusChip,
  WebAvatar,
  pagePadding,
} from '@/components/Primitives';
import { Reveal } from '@/components/Reveal';
import { SkeletonList } from '@/components/Skeleton';
import { StatTile } from '@/components/StatTile';
import { WebCard } from '@/components/WebCard';
import { WithdrawCard } from '@/features/withdrawals/WithdrawCard';
import { columnWidth, useElementWidth } from '@/hooks/useElementWidth';
import { useWindowWidth } from '@/hooks/useWindowWidth';
import { toast } from '@/hooks/useToast';

/**
 * Profile module (SOW: user profile, achievement levels, badge showcase).
 * Port of `WebProfilePage`.
 *
 * No page header here — the hero card just below already states name, level,
 * progress and key stats, so a bare "Profile" title above it was dead weight.
 * The account quick-links row that used to sit here was removed too: all four
 * links duplicated destinations already one click away in the sidebar's nav.
 */
export function ProfilePage() {
  const [rewards, setRewards] = useState<RewardsSummary | null>(null);
  const [pushStatus, setPushStatus] = useState<AuthorizationStatus | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const navigate = useNavigate();

  const [hostRef, hostWidth] = useElementWidth();
  const width = useWindowWidth();
  const padding = pagePadding(width);
  // hostWidth is already the measured CONTENT width (contentRect excludes
  // padding), so it needs no further adjustment.
  const contentWidth = hostWidth;

  const refreshPushStatus = useCallback(async () => {
    setPushStatus(await PushNotifications.permissionStatus());
  }, []);

  useEffect(() => {
    RewardsRepository.summary()
      .then(setRewards)
      .catch(() => {
        /* activity card shows its own empty state */
      });

    /**
     * Badges/stats/streak update server-side the instant a prediction resolves,
     * but the user store is otherwise only refreshed on login/auto-login — the
     * portal has no mobile-style tab-reentry hook to catch it up. Re-fetching
     * here means landing on Profile always shows the latest badge/streak state
     * instead of whatever was cached at login.
     */
    UserRepository.profile()
      .then(setUser)
      .catch(() => {
        /* keep the cached user */
      });

    void refreshPushStatus();
  }, [setUser, refreshPushStatus]);

  async function enableNotifications() {
    await registerPushToken();
    const status = await PushNotifications.permissionStatus();
    setPushStatus(status);
    toast(
      status === 'authorized' || status === 'provisional'
        ? 'Notifications enabled for this browser.'
        : status === 'denied'
          ? "Blocked by the browser. Check this site's notification permission in your browser settings."
          : "Couldn't enable notifications — please try again.",
    );
  }

  const notificationsButton = (() => {
    const label =
      pushStatus === 'authorized' || pushStatus === 'provisional'
        ? 'Notifications on'
        : pushStatus === 'denied'
          ? 'Blocked — check browser settings'
          : 'Enable notifications';
    const icon =
      pushStatus === 'authorized' || pushStatus === 'provisional' ? (
        <NotificationsActive sx={{ fontSize: 16 }} />
      ) : pushStatus === 'denied' ? (
        <NotificationsOffOutlined sx={{ fontSize: 16 }} />
      ) : (
        <NotificationsActiveOutlined sx={{ fontSize: 16 }} />
      );
    return (
      <button
        type="button"
        className="btn-outlined"
        // Stays clickable when already authorized too — clicking again just
        // re-registers the token, a harmless way to recover this browser's
        // registration without revoking and re-granting permission.
        //
        // MUST fire directly from this click: browsers (Safari in particular)
        // silently ignore a permission request that isn't triggered by a direct
        // user gesture, so this can't be requested automatically after login.
        onClick={() => void enableNotifications()}
      >
        {icon}
        {label}
      </button>
    );
  })();

  const gaugeCols = contentWidth >= 620 ? 3 : 1;
  const gaugeWidth = columnWidth(contentWidth, gaugeCols);

  const levelDisplay = nextLevelProgressDisplay({
    level: user.level,
    totalPredictions: user.totalPredictions,
    correctPredictions: user.correctPredictions,
    maxReachedLabel: "You've reached the top level!",
  });
  const next = nextLevel(user.level);

  return (
    <div style={{ padding }} ref={hostRef}>
      {/* ---- Hero: avatar + identity + inline stat chips (key numbers live
          right on the hero, not buried in a separate grid) ---- */}
      <Reveal delay={60} duration={320}>
        <WebCard>
          <ProfileHero
            wide={contentWidth >= 760}
            avatar={<WebAvatar initials={initialsOf(user.name)} seed={user.avatarSeed} radius={40} />}
            info={
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h1 className="t-headline-small">{user.name}</h1>
                  <StatusChip label={levelLabel[user.level].toUpperCase()} color={WebTokens.violet} />
                </div>
                <div
                  className="ellipsis"
                  style={{ marginTop: 4, color: WebTokens.textSecondary, fontSize: 13 }}
                >
                  {user.username.startsWith('@') ? user.username : `@${user.username}`}
                  {user.email.length > 0 ? ` · ${user.email}` : ''}
                </div>

                {/* Progress toward the next level — the real counts the backend
                    promotes on (gamification.service.ts's levelFromStats()),
                    not an XP ratio, which had no backend equivalent and could
                    show e.g. 60% while real progress was 24%. */}
                <div style={{ marginTop: 14 }}>
                  {next == null ? (
                    <span style={{ color: WebTokens.textMuted, fontSize: 12 }}>
                      {levelDisplay.goalLabel}
                    </span>
                  ) : (
                    <>
                      <div
                        style={{
                          width: contentWidth >= 760 ? 280 : 220,
                          maxWidth: '100%',
                          height: 6,
                          borderRadius: 4,
                          background: WebTokens.surfaceHover,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${levelDisplay.ratio * 100}%`,
                            height: '100%',
                            background: WebTokens.accent,
                            transition: 'width 600ms cubic-bezier(0.33,1,0.68,1)',
                          }}
                        />
                      </div>
                      <div style={{ marginTop: 6, color: WebTokens.textMuted, fontSize: 12 }}>
                        {`${levelDisplay.progressLabel} to ${levelLabel[next]}`}
                      </div>
                    </>
                  )}
                </div>
              </>
            }
            chips={
              <>
                <HeroStatChip
                  icon={<StackedBarChart sx={{ fontSize: 16 }} />}
                  value={Fmt.compactNumber(user.totalPredictions)}
                  label="Predictions"
                  accent={WebTokens.violet}
                />
                <HeroStatChip
                  icon={<CheckCircleOutline sx={{ fontSize: 16 }} />}
                  value={Fmt.compactNumber(user.correctPredictions)}
                  label="Correct"
                  accent={WebTokens.accent}
                />
                <HeroStatChip
                  icon={<MilitaryTechOutlined sx={{ fontSize: 16 }} />}
                  value={`${earnedBadges(user)}/${user.badges.length}`}
                  label="Badges"
                  accent={WebTokens.gold}
                />
              </>
            }
            actions={
              <>
                <button type="button" className="btn-outlined" onClick={() => setSignOutOpen(true)}>
                  <Logout sx={{ fontSize: 16 }} />
                  Sign out
                </button>
                <button type="button" className="btn-outlined" onClick={() => setPasswordOpen(true)}>
                  <LockOutlineRounded sx={{ fontSize: 16 }} />
                  Change password
                </button>
                {notificationsButton}
              </>
            }
          />
        </WebCard>
      </Reveal>

      <div style={{ height: 24 }} />

      {/* ---- Health stats. Flat StatTiles, not GaugeRing cards — a different
          card shape for 2 of these 3 broke visual consistency with "Global
          rank" (and with the rest of the portal's stat rows). ---- */}
      <Reveal delay={120} duration={320}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ width: gaugeWidth > 0 ? gaugeWidth : '100%' }}>
            <StatTile
              icon={<CenterFocusStrongRounded />}
              label="Prediction accuracy"
              value={`${Math.round(accuracyOf(user) * 100)}%`}
              accent={WebTokens.gold}
            />
          </div>
          <div style={{ width: gaugeWidth > 0 ? gaugeWidth : '100%' }}>
            <StatTile
              icon={<LocalFireDepartmentRounded />}
              // StatTile's `delta` renders as a ▲/▼ change indicator — wrong
              // semantics for "best streak", which isn't a change. Folded into
              // value/label instead.
              label="Current / best streak"
              value={`${user.currentStreak} / ${user.bestStreak}`}
              accent={WebTokens.coral}
            />
          </div>
          <div style={{ width: gaugeWidth > 0 ? gaugeWidth : '100%' }}>
            <StatTile
              icon={<Public />}
              label="Global rank"
              value={user.globalRank > 0 ? `#${user.globalRank}` : '—'}
              accent={WebTokens.blue}
            />
          </div>
        </div>
      </Reveal>

      <div style={{ height: 32 }} />

      {/* ---- Points & withdrawals: the balance broken down by what may be
          cashed out, plus the Withdraw action and request history ---- */}
      <Reveal delay={160} duration={320}>
        <WithdrawCard contentWidth={contentWidth} />
      </Reveal>

      <div style={{ height: 32 }} />

      {/* ---- Recent activity: real coin-ledger events, not just static stats —
          gives the profile a lived-in feel ---- */}
      <Reveal delay={180} duration={320}>
        <SectionHeader
          title="Recent activity"
          trailing={
            <button
              type="button"
              className="btn-text"
              style={{ color: WebTokens.accent }}
              onClick={() => navigate(Routes.rewards)}
            >
              View all
            </button>
          }
        />
        <ProfileActivityCard rewards={rewards} />
      </Reveal>

      <div style={{ height: 32 }} />

      {/* ---- Main achievements: circular medallions, earned ones glow ---- */}
      <Reveal delay={240} duration={320}>
        <SectionHeader
          title="Main achievements"
          trailing={
            <span style={{ color: WebTokens.textMuted, fontSize: 13 }}>
              {earnedBadges(user)} / {user.badges.length} earned
            </span>
          }
        />
        <WebCard>
          {user.badges.length === 0 ? (
            <EmptyState
              icon={<MilitaryTechOutlined sx={{ fontSize: 30 }} />}
              title="No badges yet"
              subtitle="Play a prediction to start earning achievements."
            />
          ) : (
            <HScrollArrows>
              {user.badges.map((b) => (
                <BadgeMedallion key={b.type} badge={b} />
              ))}
            </HScrollArrows>
          )}
        </WebCard>
      </Reveal>

      <div style={{ height: 32 }} />

      {/* ---- Level path: connected badges, glowing ring on the current one ---- */}
      <Reveal delay={300} duration={320}>
        <SectionHeader title="Achievement levels" />
        <WebCard>
          <LevelPath
            levels={USER_LEVELS}
            current={user.level}
            totalPredictions={user.totalPredictions}
            correctPredictions={user.correctPredictions}
          />
        </WebCard>
      </Reveal>

      <Modal open={signOutOpen} onClose={() => setSignOutOpen(false)}>
        <AlertDialogCard
          title="Sign out?"
          actions={
            <>
              <button type="button" className="btn-text" onClick={() => setSignOutOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-filled"
                onClick={() => {
                  setSignOutOpen(false);
                  // The router guard redirects to /login on the auth change.
                  void performWebLogout();
                }}
              >
                Sign out
              </button>
            </>
          }
        >
          <p style={{ color: WebTokens.textSecondary, fontSize: 14 }}>You can sign back in anytime.</p>
        </AlertDialogCard>
      </Modal>

      <Modal open={passwordOpen} onClose={() => setPasswordOpen(false)}>
        {passwordOpen && <ChangePasswordDialog onClose={() => setPasswordOpen(false)} />}
      </Modal>
    </div>
  );
}

function ProfileHero({
  wide,
  avatar,
  info,
  chips,
  actions,
}: {
  wide: boolean;
  avatar: ReactNode;
  info: ReactNode;
  chips: ReactNode;
  actions: ReactNode;
}) {
  if (!wide) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        {avatar}
        <div style={{ marginTop: 16, textAlign: 'center', width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>{info}</div>
        </div>
        <div
          style={{
            marginTop: 18,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            justifyContent: 'center',
          }}
        >
          {chips}
        </div>
        <div
          style={{
            marginTop: 20,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            justifyContent: 'center',
          }}
        >
          {actions}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, width: '100%' }}>
        {avatar}
        <div style={{ flex: 1, minWidth: 0 }}>{info}</div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 10,
            flexShrink: 0,
          }}
        >
          {actions}
        </div>
      </div>
      <div
        style={{
          marginTop: 18,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          justifyContent: 'flex-end',
        }}
      >
        {chips}
      </div>
    </div>
  );
}

/** Compact inline stat pill for the profile hero. */
function HeroStatChip({
  icon,
  value,
  label,
  accent,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  accent: string;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        background: withAlpha(accent, 0.08),
        borderRadius: WebTokens.radiusControl,
        border: `1px solid ${withAlpha(accent, 0.25)}`,
      }}
    >
      <span style={{ display: 'inline-flex', color: accent }}>{icon}</span>
      <span style={{ fontWeight: 800, fontSize: 15 }}>{value}</span>
      <span style={{ color: WebTokens.textMuted, fontSize: 12 }}>{label}</span>
    </span>
  );
}

/**
 * Recent coin-ledger events on the profile — the same real data behind the
 * Rewards page, surfaced here so the profile feels lived-in rather than a
 * static stat sheet.
 */
function ProfileActivityCard({ rewards }: { rewards: RewardsSummary | null }) {
  const recent = rewards?.recent;

  if (recent == null) return <SkeletonList count={2} height={56} />;

  if (recent.length === 0) {
    return (
      <WebCard>
        <EmptyState
          icon={<ReceiptLongOutlined sx={{ fontSize: 30 }} />}
          title="No activity yet"
          subtitle="Play a prediction to start your activity feed."
        />
      </WebCard>
    );
  }

  return (
    <WebCard padding={0}>
      {recent.slice(0, 4).map((t, i) => (
        <div key={t.id}>
          {i > 0 && <div className="divider" />}
          <div style={{ padding: '0 6px' }}>
            <ActivityRow txn={t} />
          </div>
        </div>
      ))}
    </WebCard>
  );
}

function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changePassword = useAuthStore((s) => s.changePassword);

  async function submit() {
    setError(null);
    if (current.length === 0) return setError('Enter your current password.');
    if (next.length < 6) return setError('New password must be at least 6 characters.');
    if (next !== confirm) return setError('Passwords do not match.');

    setBusy(true);
    const result = await changePassword(current, next);
    setBusy(false);
    if (result != null) {
      setError(result);
      return;
    }
    onClose();
    toast('Password updated successfully.');
  }

  return (
    <AlertDialogCard
      title="Change password"
      width={380}
      actions={
        <>
          <button type="button" className="btn-text" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-filled" disabled={busy} onClick={() => void submit()}>
            {busy ? 'Updating…' : 'Update'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <PasswordField
          value={current}
          onChange={setCurrent}
          placeholder="Current password"
          visible={showCurrent}
          onToggle={() => setShowCurrent((v) => !v)}
        />
        <PasswordField
          value={next}
          onChange={setNext}
          placeholder="New password"
          visible={showNext}
          onToggle={() => setShowNext((v) => !v)}
        />
        <PasswordField
          value={confirm}
          onChange={setConfirm}
          placeholder="Confirm new password"
          visible={showConfirm}
          onToggle={() => setShowConfirm((v) => !v)}
          onSubmit={() => void submit()}
        />
        {error != null && <span className="field-error">{error}</span>}
      </div>
    </AlertDialogCard>
  );
}

function PasswordField({
  value,
  onChange,
  placeholder,
  visible,
  onToggle,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  visible: boolean;
  onToggle: () => void;
  onSubmit?: () => void;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        className="field"
        type={visible ? 'text' : 'password'}
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit?.();
        }}
        style={{ paddingRight: 46 }}
      />
      <button
        type="button"
        aria-label={visible ? 'Hide password' : 'Show password'}
        onClick={onToggle}
        style={{
          position: 'absolute',
          right: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          color: WebTokens.textMuted,
          display: 'inline-flex',
        }}
      >
        {visible ? (
          <VisibilityRounded sx={{ fontSize: 18 }} />
        ) : (
          <VisibilityOffRounded sx={{ fontSize: 18 }} />
        )}
      </button>
    </div>
  );
}
