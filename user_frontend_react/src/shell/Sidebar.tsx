import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import GridViewRounded from '@mui/icons-material/GridViewRounded';
import EmojiEventsRounded from '@mui/icons-material/EmojiEventsRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import { CategoryCatalog, accentByName } from '@/data/categoryCatalog';
import { Routes } from '@/router/routes';
import { useAuthStore } from '@/store/authStore';
import { useConfigStore } from '@/store/configStore';
import { usePredictionsStore } from '@/store/predictionsStore';
import { WebTokens, withAlpha } from '@/theme/webTokens';
import { accentColor } from '@/components/accents';
import { GlowButton } from '@/components/GlowButton';
import { Icon } from '@/components/Icon';
import { PRIMARY_NAV, navItemFor, navTint, type NavItem } from './navItems';
import { SearchBox } from './SearchBox';

/**
 * Solid opaque sidebar (fixed width, full page height) — primary nav plus a
 * content-browsing panel: sign-in prompt for guests, search, and category
 * submenus. A solid fill rather than a backdrop blur: the blur let the aurora
 * backdrop's colored blobs show through as an unwanted tint, and a flat panel
 * matches the reference exactly while being cheaper to paint.
 */
export function Sidebar({
  expanded,
  onNavigate,
}: {
  expanded: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav
      aria-label="Primary"
      style={{
        width: expanded ? WebTokens.sidebarWidth : WebTokens.sidebarRailWidth,
        flexShrink: 0,
        background: WebTokens.surface,
        borderRight: `${WebTokens.borderWidth}px solid ${WebTokens.chromeDivider}`,
        transition: 'width 200ms cubic-bezier(0.33,1,0.68,1)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {expanded ? <SidebarContent onNavigate={onNavigate} /> : <SidebarRail />}
    </nav>
  );
}

/**
 * Collapsed-rail view — a faithful miniature of the expanded panel: primary
 * nav + every category (colored icon), all as tooltipped icon buttons. Never
 * drops content the expanded view has.
 */
function SidebarRail() {
  const counts = usePredictionsStore((s) => s.categoryCounts);
  const location = useLocation();
  const navigate = useNavigate();
  // Re-render when the category catalog lands.
  useConfigStore((s) => s.categoriesVersion);

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 0' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {PRIMARY_NAV.map((item) => (
          <RailIcon
            key={item.route}
            icon={item.icon}
            tooltip={item.label}
            tint={navTint(item.route)}
            selected={location.pathname.startsWith(item.route)}
            onClick={() => navigate(item.route)}
          />
        ))}

        {CategoryCatalog.isLoaded && (
          <>
            <div
              style={{
                width: 28,
                height: 1,
                margin: '8px 0',
                background: WebTokens.border,
              }}
            />
            {CategoryCatalog.all.map((c) => (
              <RailIcon
                key={c.key}
                icon={<Icon name={c.iconName} size={18} />}
                tooltip={c.label}
                tint={accentColor(accentByName(c.accent))}
                badge={counts[c.key] ?? 0}
                onClick={() => navigate(`${Routes.predictions}?category=${c.key}`)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Single tooltipped icon in the collapsed rail — tinted tile + optional count
 * dot, matching the expanded tiles' color language.
 */
function RailIcon({
  icon,
  tooltip,
  tint = WebTokens.textSecondary,
  badge,
  selected = false,
  onClick,
}: {
  icon: ReactNode;
  tooltip: string;
  tint?: string;
  badge?: number;
  selected?: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const active = selected || hover;
  const hasBadge = badge != null && badge > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={hasBadge ? `${tooltip} (${badge})` : tooltip}
      aria-label={tooltip}
      aria-current={selected ? 'page' : undefined}
      style={{
        position: 'relative',
        width: 40,
        height: 40,
        margin: '3px 0',
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: withAlpha(tint, active ? 0.2 : 0.1),
        borderRadius: 11,
        border: `1px solid ${selected ? withAlpha(tint, 0.6) : 'transparent'}`,
        color: tint,
        fontSize: 18,
      }}
    >
      <span style={{ display: 'inline-flex', fontSize: 18 }}>{icon}</span>
      {hasBadge && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: tint,
            border: `1.5px solid ${WebTokens.bg}`,
          }}
        />
      )}
    </button>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const authenticated = useAuthStore((s) => s.authenticated);
  const openTotal = usePredictionsStore((s) => s.openTotal);
  const counts = usePredictionsStore((s) => s.categoryCounts);
  const location = useLocation();
  const navigate = useNavigate();
  useConfigStore((s) => s.categoriesVersion);

  const params = new URLSearchParams(location.search);
  const path = location.pathname;
  const onPredictions = path.startsWith(Routes.predictions);
  const currentCategory = params.get('category');
  const onLeaderboard = path.startsWith(Routes.leaderboard);
  const onLuckyWinners = path.startsWith(Routes.luckyWinners);

  const go = (to: string) => {
    onNavigate?.();
    navigate(to);
  };

  const goCategory = (key: string | null) =>
    go(key == null ? Routes.predictions : `${Routes.predictions}?category=${key}`);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <div style={{ height: 16 }} />

        {/* Guests get a sign-in prompt in this slot; signed-in users go
            straight into the flat nav list below. */}
        {!authenticated && (
          <>
            <div style={{ padding: '0 14px' }}>
              <GuestCard onSignIn={() => go(Routes.login)} />
            </div>
            <div style={{ height: 16 }} />
          </>
        )}

        <div style={{ padding: '0 16px' }}>
          <SearchBox navigateOnClear onNavigate={onNavigate} />
        </div>

        <div style={{ height: 16 }} />

        {/* Flat list, no section headers/dividers — Home / All Predictions /
            Ranking / Quiz / Rewards / Profile are the main destinations;
            categories and Lucky Winners live as collapsible submenus under All
            Predictions/Ranking respectively, not as their own always-visible
            rows. */}
        <PrimaryNavTile
          item={navItemFor(Routes.dashboard)}
          selected={path.startsWith(Routes.dashboard)}
          onClick={() => go(Routes.dashboard)}
        />

        <ExpandableNavTile
          icon={<GridViewRounded />}
          label="All Predictions"
          tint={WebTokens.accent}
          // True total, not open.length — that list is capped to a 20-item page.
          count={openTotal}
          selected={onPredictions && !currentCategory}
          startExpanded={onPredictions}
          onClick={() => goCategory(null)}
        >
          {CategoryCatalog.all.map((c) => (
            <SubNavTile
              key={c.key}
              label={c.label}
              count={counts[c.key] ?? 0}
              selected={onPredictions && currentCategory === c.key}
              onClick={() => goCategory(c.key)}
            />
          ))}
        </ExpandableNavTile>

        <ExpandableNavTile
          icon={<EmojiEventsRounded />}
          label="Ranking"
          tint={WebTokens.violet}
          selected={onLeaderboard && !onLuckyWinners}
          startExpanded={onLeaderboard || onLuckyWinners}
          onClick={() => go(Routes.leaderboard)}
        >
          <SubNavTile
            label="Lucky Winners"
            selected={onLuckyWinners}
            onClick={() => go(Routes.luckyWinners)}
          />
        </ExpandableNavTile>

        <PrimaryNavTile
          item={navItemFor(Routes.quiz)}
          selected={path.startsWith(Routes.quiz)}
          onClick={() => go(Routes.quiz)}
        />
        <PrimaryNavTile
          item={navItemFor(Routes.points)}
          selected={path.startsWith(Routes.points)}
          onClick={() => go(Routes.points)}
        />
        <PrimaryNavTile
          item={navItemFor(Routes.rewards)}
          selected={path.startsWith(Routes.rewards)}
          onClick={() => go(Routes.rewards)}
        />
        <PrimaryNavTile
          item={navItemFor(Routes.profile)}
          selected={path.startsWith(Routes.profile)}
          onClick={() => go(Routes.profile)}
        />

        <div style={{ height: 10 }} />
      </div>

      <div style={{ height: 1, background: WebTokens.border }} />
      <div style={{ padding: '12px 16px' }}>
        <span style={{ color: WebTokens.textMuted, fontSize: 10 }}>GOGETA Web Portal</span>
      </div>
    </div>
  );
}

/**
 * Sign-in prompt shown to guests instead of the balance card — no misleading
 * zeroed stats for signed-out visitors.
 */
function GuestCard({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div
      style={{
        padding: 14,
        background: WebTokens.surfaceAlt,
        borderRadius: 16,
        border: `1px solid ${WebTokens.border}`,
      }}
    >
      <div style={{ color: WebTokens.textPrimary, fontSize: 13, fontWeight: 600 }}>
        Track your picks
      </div>
      <div
        className="f-inter"
        style={{
          marginTop: 4,
          color: WebTokens.textMuted,
          fontSize: 11,
          fontWeight: 500,
          lineHeight: 1.3,
        }}
      >
        Sign in to play predictions and earn points.
      </div>
      <div style={{ marginTop: 12 }}>
        <GlowButton label="Sign in" fullWidth onClick={onSignIn} />
      </div>
    </div>
  );
}

/**
 * A primary nav row — a larger target with a filled/tinted selected state.
 * Selected state = background tint only, no outline border: a bordered box on
 * every selected/hovered row read as a highlighted "alert" state rather than
 * calm current-page navigation.
 */
function PrimaryNavTile({
  item,
  selected,
  onClick,
}: {
  item: NavItem;
  selected: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const active = selected || hover;
  const tint = navTint(item.route);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-current={selected ? 'page' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: 'calc(100% - 20px)',
        margin: '2px 10px',
        padding: '11px 12px',
        background: selected
          ? withAlpha(tint, 0.14)
          : hover
            ? 'rgba(255,255,255,0.05)'
            : 'transparent',
        borderRadius: 12,
        textAlign: 'left',
        transition: 'background 140ms ease',
      }}
    >
      <span
        style={{ display: 'inline-flex', fontSize: 18, color: active ? tint : WebTokens.textSecondary }}
      >
        {item.icon}
      </span>
      <span
        className="ellipsis f-poppins"
        style={{
          flex: 1,
          color: active ? WebTokens.textPrimary : WebTokens.textSecondary,
          fontSize: 13,
          fontWeight: selected ? 700 : 600,
        }}
      >
        {item.label}
      </span>
    </button>
  );
}

/** A browse row: tinted icon tile + label + count badge, in the item's accent. */
function NavTile({
  icon,
  label,
  tint,
  count = 0,
  selected = false,
  trailing,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  tint: string;
  count?: number;
  selected?: boolean;
  trailing?: ReactNode;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const active = selected || hover;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        margin: '1px 12px',
        padding: '6px 8px',
        background: active ? 'rgba(255,255,255,0.05)' : 'transparent',
        borderRadius: 11,
      }}
    >
      <button
        type="button"
        onClick={onClick}
        aria-current={selected ? 'page' : undefined}
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          textAlign: 'left',
        }}
      >
        <span
          style={{
            width: 30,
            height: 30,
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: withAlpha(tint, active ? 0.22 : 0.13),
            borderRadius: 9,
            color: tint,
            fontSize: 16,
          }}
        >
          {icon}
        </span>
        <span
          className="ellipsis f-poppins"
          style={{
            flex: 1,
            color: active ? WebTokens.textPrimary : WebTokens.textSecondary,
            fontSize: 12,
            fontWeight: selected ? 700 : 600,
          }}
        >
          {label}
        </span>
        {count > 0 && <CountBadge count={count} />}
      </button>
      {trailing}
    </div>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span
      style={{
        padding: '2px 7px',
        background: WebTokens.surfaceAlt,
        borderRadius: 999,
        color: WebTokens.textMuted,
        fontSize: 10,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {count}
    </span>
  );
}

/**
 * A main nav item with a collapsible submenu (All Predictions -> categories,
 * Ranking -> Lucky Winners) — clicking the row navigates to that section's own
 * page; the separate chevron toggles the submenu without navigating.
 *
 * Starts expanded whenever the current route is this section itself or one of
 * its children, so landing here from elsewhere always reveals the relevant
 * sub-items; collapsing is otherwise a pure manual choice that isn't fought on
 * every re-render.
 */
function ExpandableNavTile({
  icon,
  label,
  tint,
  selected,
  startExpanded,
  count = 0,
  onClick,
  children,
}: {
  icon: ReactNode;
  label: string;
  tint: string;
  selected: boolean;
  startExpanded: boolean;
  count?: number;
  onClick: () => void;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(startExpanded);
  const wasStartExpanded = useState({ value: startExpanded })[0];

  useEffect(() => {
    if (!wasStartExpanded.value && startExpanded) setExpanded(true);
    wasStartExpanded.value = startExpanded;
  }, [startExpanded, wasStartExpanded]);

  return (
    <div>
      <NavTile
        icon={icon}
        label={label}
        tint={tint}
        count={count}
        selected={selected}
        onClick={onClick}
        trailing={
          <button
            type="button"
            aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            // Larger target than the bare 16px icon — easy to miss otherwise,
            // sitting right at the row's edge.
            style={{ padding: 6, display: 'inline-flex', color: WebTokens.textMuted }}
          >
            <ChevronRightRounded
              sx={{ fontSize: 16 }}
              style={{
                transform: expanded ? 'rotate(90deg)' : 'none',
                transition: 'transform 180ms ease',
              }}
            />
          </button>
        }
      />
      {expanded && <div style={{ paddingLeft: 18 }}>{children}</div>}
    </div>
  );
}

/**
 * Indented submenu row (a category under All Predictions, Lucky Winners under
 * Ranking) — smaller and lighter than a main NavTile, with a left guide line
 * echoing the reference's sub-item indent treatment.
 */
function SubNavTile({
  label,
  count = 0,
  selected,
  onClick,
}: {
  label: string;
  count?: number;
  selected: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const active = selected || hover;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-current={selected ? 'page' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        margin: '1px 0',
        padding: '7px 10px',
        background: selected
          ? 'rgba(255,255,255,0.06)'
          : hover
            ? 'rgba(255,255,255,0.04)'
            : 'transparent',
        borderLeft: `2px solid ${active ? WebTokens.accent : WebTokens.border}`,
        textAlign: 'left',
      }}
    >
      <span style={{ width: 10, flexShrink: 0 }} />
      <span
        className="ellipsis f-inter"
        style={{
          flex: 1,
          // Category rows want a true w400 — Poppins only ships 500/600/700,
          // so an unregistered w400 request on that family would synthesise a
          // faked light face. Inter has 400 actually bundled.
          fontSize: 12,
          fontWeight: 400,
          color: active ? WebTokens.textPrimary : WebTokens.textSecondary,
        }}
      >
        {label}
      </span>
      {count > 0 && <CountBadge count={count} />}
    </button>
  );
}
