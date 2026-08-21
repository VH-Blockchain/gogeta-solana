import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import MenuIcon from '@mui/icons-material/Menu';
import BoltRounded from '@mui/icons-material/BoltRounded';
import Bolt from '@mui/icons-material/Bolt';
import AddRounded from '@mui/icons-material/AddRounded';
import LeaderboardRounded from '@mui/icons-material/LeaderboardRounded';
import NotificationsNone from '@mui/icons-material/NotificationsNone';
import PersonOutline from '@mui/icons-material/PersonOutline';
import Logout from '@mui/icons-material/Logout';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import { performWebLogout } from '@/core/push/logout';
import { Routes } from '@/router/routes';
import { useAuthStore } from '@/store/authStore';
import { useNotificationsStore, unreadCount } from '@/store/notificationsStore';
import { usePointsStore } from '@/store/pointsStore';
import { useUserStore } from '@/store/userStore';
import { WebTokens, cardShadow, goldGradient, withAlpha } from '@/theme/webTokens';
import { GlowButton } from '@/components/GlowButton';
import { AlertDialogCard, Modal } from '@/components/Modal';
import { useWindowWidth } from '@/hooks/useWindowWidth';
import type { AppUser } from '@/data/models';
import { BuyPointsDialog } from '@/features/points/BuyPointsDialog';
import { Logo } from './Logo';
import { SearchBox } from './SearchBox';

/**
 * Blurred glass topbar — logo, greeting, a compact (not stretched) search box,
 * then a right-hand cluster of controls. No nav links and no sidebar-collapse
 * control here: the collapse toggle lives on the sidebar's own edge.
 */
export function TopBar({
  showMenuButton,
  onOpenDrawer,
}: {
  showMenuButton: boolean;
  onOpenDrawer: () => void;
}) {
  const authenticated = useAuthStore((s) => s.authenticated);
  const user = useUserStore((s) => s.user);
  const navigate = useNavigate();
  const width = useWindowWidth();

  const showSearch = width >= 720;
  const narrow = width < 860;

  return (
    <header
      style={{
        height: WebTokens.topBarHeight,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        padding: '0 20px',
        background: WebTokens.surface,
        borderBottom: `${WebTokens.borderWidth}px solid ${WebTokens.chromeDivider}`,
      }}
    >
      {showMenuButton && (
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onOpenDrawer}
          style={{
            marginRight: 8,
            padding: 8,
            display: 'inline-flex',
            color: WebTokens.textSecondary,
          }}
        >
          <MenuIcon sx={{ fontSize: 22 }} />
        </button>
      )}

      {/* 1. Logo */}
      <Logo />

      {/* Greeting fills the gap next to the logo instead of leaving it empty —
          a personal touch, hidden once things get tight. Poppins + an
          accent-colored keyword makes it read as a real headline moment, not a
          plain "Hi, name" label. */}
      {authenticated && showSearch && (
        <span
          className="f-poppins"
          style={{
            marginLeft: 20,
            fontWeight: 400,
            fontSize: 15,
            color: WebTokens.textPrimary,
            whiteSpace: 'nowrap',
          }}
        >
          Ready to <span style={{ color: WebTokens.accent }}>predict</span>
          {`, ${user.name.split(' ')[0]}?`}
        </span>
      )}

      {/* Search floats right-of-center: a real gap after the logo, then the
          search box, biased toward the right cluster. */}
      <span style={{ flex: 3 }} />
      {showSearch && (
        <div style={{ width: 320, maxWidth: 420, flexShrink: 1 }}>
          <SearchBox fontSize={13} showClear={false} />
        </div>
      )}
      <span style={{ flex: 2 }} />

      {authenticated ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {/* 3. Balance + Buy points */}
          <BalanceInline coins={user.coins} onClick={() => navigate(Routes.points)} />
          <BuyPointsButton width={width} />

          {/* 4. Predict now */}
          {!narrow && (
            <div style={{ marginLeft: 6 }}>
              <GlowButton
                label="Predict now"
                icon={<Bolt />}
                pill
                height={38}
                onClick={() => navigate(Routes.predictions)}
              />
            </div>
          )}

          {/* 5. Leaderboard shortcut */}
          <TopIconButton
            icon={<LeaderboardRounded sx={{ fontSize: 18 }} />}
            tooltip="Leaderboard"
            onClick={() => navigate(Routes.leaderboard)}
          />

          {/* 6. Notifications */}
          <NotificationsBell />

          {/* 7. Account — avatar only, no name label. */}
          <AvatarMenu user={user} showName={false} />
        </div>
      ) : (
        <GlowButton label="Sign in" onClick={() => navigate(Routes.login)} />
      )}

      {/* Mounted once here rather than per page: the Buy button is in the
          header, so the dialog has to live above the routed content. The Points
          page opens this same instance through the store. */}
      {authenticated && <TopBarBuyPointsDialog />}
    </header>
  );
}

/**
 * The header's Add Points control.
 *
 * Same GlowButton recipe as "Predict now" — gradient pill, 38px, leading icon —
 * so the two read as one family of header actions. Gold rather than the accent
 * gradient: it keeps the points/rewards colour language the balance beside it
 * already uses, and leaves "Predict now" as the visually primary CTA rather
 * than putting two identical blue pills side by side.
 *
 * Sits directly next to the balance so "how many points I have" and "get more"
 * read as one unit.
 */
function BuyPointsButton({ width }: { width: number }) {
  const openBuy = usePointsStore((s) => s.openBuy);
  const config = usePointsStore((s) => s.config);
  const loadConfig = usePointsStore((s) => s.loadConfig);

  // Loaded once for the whole session so the button can disable itself when
  // purchasing is switched off, rather than opening a dialog that cannot work.
  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const unavailable = config != null && !config.enabled;
  // Shortened rather than hidden on a tight header: topping up is still
  // reachable on a phone, where "Predict now" already drops out entirely.
  const label = width >= WebTokens.bpTablet ? 'Add Points' : 'Add';

  return (
    <div style={{ marginLeft: 6 }} title={unavailable ? (config?.unavailableReason ?? 'Buying points is unavailable') : 'Buy points with USDC'}>
      <GlowButton
        label={label}
        icon={<AddRounded />}
        pill
        height={38}
        gradient={goldGradient}
        glowColor={WebTokens.gold}
        onClick={unavailable ? null : openBuy}
      />
    </div>
  );
}

/** Reads the shared open flag so the header and the Points page share a dialog. */
function TopBarBuyPointsDialog() {
  const buyOpen = usePointsStore((s) => s.buyOpen);
  const closeBuy = usePointsStore((s) => s.closeBuy);
  const config = usePointsStore((s) => s.config);
  return <BuyPointsDialog open={buyOpen} onClose={closeBuy} config={config} />;
}

/** Small round icon button — the same chrome as the notifications bell. */
function TopIconButton({
  icon,
  tooltip,
  onClick,
}: {
  icon: ReactNode;
  tooltip: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={tooltip}
      aria-label={tooltip}
      onClick={onClick}
      style={{
        width: 38,
        height: 38,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        background: WebTokens.surfaceAlt,
        border: `1px solid ${WebTokens.border}`,
        color: WebTokens.textSecondary,
      }}
    >
      {icon}
    </button>
  );
}

/**
 * Plain inline coin balance — icon + number, no pill background. Clickable, so
 * the number itself leads to the Points page where the full balance, purchase
 * history and rate live.
 */
function BalanceInline({ coins, onClick }: { coins: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Points balance"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <BoltRounded sx={{ fontSize: 17 }} style={{ color: WebTokens.gold }} />
      <span
        className="f-opensans"
        style={{ fontWeight: 600, fontSize: 14, color: WebTokens.textPrimary }}
      >
        {coins.toLocaleString()}
      </span>
    </button>
  );
}

/** Topbar bell: unread dot + navigate to the notifications page. */
function NotificationsBell() {
  const unread = useNotificationsStore(unreadCount);
  const navigate = useNavigate();

  return (
    <button
      type="button"
      title="Notifications"
      aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
      onClick={() => navigate(Routes.notifications)}
      style={{
        position: 'relative',
        width: 38,
        height: 38,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: WebTokens.textSecondary,
      }}
    >
      <NotificationsNone sx={{ fontSize: 22 }} />
      {unread > 0 && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 7,
            right: 7,
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: WebTokens.accent,
            border: `1.5px solid ${WebTokens.bg}`,
          }}
        />
      )}
    </button>
  );
}

/** Avatar with a glass dropdown: profile + sign out. */
export function AvatarMenu({ user, showName = true }: { user: AppUser; showName?: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          type="button"
          title="Account"
          aria-label="Account"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <span
            style={{
              width: 34,
              height: 34,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              background: WebTokens.surfaceHover,
              color: WebTokens.textPrimary,
              fontSize: 13,
            }}
          >
            {user.name.length > 0 ? user.name[0].toUpperCase() : '?'}
          </span>
          {showName && (
            <>
              <span
                style={{ color: WebTokens.textPrimary, fontSize: 13.5, fontWeight: 600 }}
              >
                {user.name.trim().split(' ')[0]}
              </span>
              <ExpandMoreRounded sx={{ fontSize: 18 }} style={{ color: WebTokens.textMuted }} />
            </>
          )}
        </button>

        {open && (
          <div
            role="menu"
            style={{
              position: 'absolute',
              top: 48,
              right: 0,
              minWidth: 220,
              padding: 8,
              background: WebTokens.surfaceAlt,
              border: `1px solid ${WebTokens.borderStrong}`,
              borderRadius: 16,
              boxShadow: cardShadow,
              zIndex: 200,
            }}
          >
            <div style={{ padding: '10px 12px' }}>
              <div
                className="ellipsis"
                style={{ color: WebTokens.textPrimary, fontWeight: 700, fontSize: 14 }}
              >
                {user.name}
              </div>
              <div className="ellipsis" style={{ color: WebTokens.textMuted, fontSize: 12 }}>
                {user.email}
              </div>
            </div>
            <div style={{ height: 1, background: WebTokens.border, margin: '4px 0' }} />
            <MenuRow
              icon={<PersonOutline sx={{ fontSize: 18 }} />}
              label="My profile"
              onClick={() => {
                setOpen(false);
                navigate(Routes.profile);
              }}
            />
            <MenuRow
              icon={<Logout sx={{ fontSize: 18 }} />}
              label="Sign out"
              danger
              onClick={() => {
                setOpen(false);
                setConfirmOpen(true);
              }}
            />
          </div>
        )}
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <AlertDialogCard
          title="Sign out?"
          actions={
            <>
              <button type="button" className="btn-text" onClick={() => setConfirmOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-filled"
                onClick={() => {
                  setConfirmOpen(false);
                  void performWebLogout();
                }}
              >
                Sign out
              </button>
            </>
          }
        >
          <p style={{ color: WebTokens.textSecondary, fontSize: 14 }}>
            You can sign back in any time.
          </p>
        </AlertDialogCard>
      </Modal>
    </>
  );
}

function MenuRow({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const color = danger ? WebTokens.danger : WebTokens.textSecondary;
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '10px 12px',
        borderRadius: 10,
        background: hover ? withAlpha(danger ? WebTokens.danger : '#FFFFFF', 0.06) : 'transparent',
        color: danger ? WebTokens.danger : WebTokens.textPrimary,
        fontSize: 13.5,
        textAlign: 'left',
      }}
    >
      <span style={{ display: 'inline-flex', color }}>{icon}</span>
      {label}
    </button>
  );
}
