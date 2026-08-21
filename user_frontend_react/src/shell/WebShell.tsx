import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import { RewardsRepository, type RewardsSummary } from '@/data/api/rewardsRepository';
import { useAuthStore } from '@/store/authStore';
import { useConfigStore } from '@/store/configStore';
import { useNotificationsStore } from '@/store/notificationsStore';
import { usePredictionsStore } from '@/store/predictionsStore';
import { WebTokens } from '@/theme/webTokens';
import { AuroraBackdrop } from '@/components/AuroraBackdrop';
import { PredictSubmitBar } from '@/components/PredictSubmitBar';
import { PredictionDetailPanel } from '@/features/predictions/PredictionDetailPanel';
import { useWindowWidth } from '@/hooks/useWindowWidth';
import { Logo } from './Logo';
import { RightRail } from './RightRail';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import './WebShell.css';

/**
 * Portal chrome: topbar (logo + search + account row only, no nav links) —
 * left sidebar (full primary nav + category browsing) — main content — right
 * rail (bonus banner + live activity feed) on wide viewports.
 *
 * >=1024px: full sidebar with labels. 640..1024px: icon-only rail. <640px: no
 * sidebar; a hamburger in the topbar opens a drawer with the full nav. The
 * right rail only shows at >=1280px — it's supplementary, not core nav.
 *
 * Port of `WebShell`.
 */
export function WebShell() {
  // Manual collapse toggle (desktop only). Session-only, not persisted.
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activitySummary, setActivitySummary] = useState<RewardsSummary | null>(null);

  const authenticated = useAuthStore((s) => s.authenticated);
  const loadCategories = useConfigStore((s) => s.loadCategories);
  const loadNotifications = useNotificationsStore((s) => s.load);
  const loadOpen = usePredictionsStore((s) => s.loadOpen);
  const loadActive = usePredictionsStore((s) => s.loadActive);
  const loadHistory = usePredictionsStore((s) => s.loadHistory);

  const width = useWindowWidth();
  const isDesktop = width >= WebTokens.bpDesktop;
  const isMobile = width < WebTokens.bpTablet;
  const showRightRail = width >= WebTokens.bpWideRail && authenticated;
  const sidebarExpanded = isDesktop && !collapsed;

  /**
   * One-time portal-session bootstrap. Admin-managed categories need auth, so
   * they're fetched once the portal mounts; cards resolve label/icon through
   * CategoryCatalog instead of the built-in fallback set.
   *
   * The sidebar's quick-stats/category counts need the prediction lists even on
   * pages that don't fetch them themselves (Rewards/Profile/Leaderboard), so
   * they're loaded once here rather than per page — which also avoids the race
   * where a page's own loadOpen() overlapped the shell's in-flight one and left
   * the feed stuck on its loading state.
   */
  useEffect(() => {
    void loadCategories();
    void loadNotifications();
    void loadOpen();
    void loadActive();
    void loadHistory();
    // The right rail's activity feed is global, so the shell fetches it once
    // for every page instead of duplicating per page.
    RewardsRepository.summary()
      .then(setActivitySummary)
      .catch(() => {
        /* rail shows its own empty/skeleton state */
      });
  }, [loadCategories, loadNotifications, loadOpen, loadActive, loadHistory]);

  // Close the mobile drawer as soon as the viewport grows past mobile.
  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile]);

  return (
    <AuroraBackdrop dimmed fill>
      <TopBar showMenuButton={isMobile} onOpenDrawer={() => setDrawerOpen(true)} />

      <div className="shell__body">
        <div className="shell__row">
          {!isMobile && <Sidebar expanded={sidebarExpanded} />}

          <main className="shell__main">
            {/* Content hugs the sidebar (left) rather than floating centered in
                leftover space on wide viewports. */}
            <div className="shell__content">
              <Outlet />
            </div>

            {/* Global pick-basket bar — visible across the whole portal
                (mirrors the app stacking its submit bar over the bottom nav in
                every tab, not just Predict). */}
            <PredictSubmitBar />
          </main>

          {showRightRail && <RightRail summary={activitySummary} />}
        </div>

        {/*
         * Sits just above the sidebar's edge — a clear corner control instead of
         * floating in the middle of the sidebar's height. Deliberately a
         * sibling of the sidebar rather than a child poking out via a negative
         * offset: a child that visually overflows its parent's width is still
         * hit-tested only within that parent's box in some layouts, which made
         * roughly half of the circular button unclickable (PO-44).
         */}
        {!isMobile && (
          <button
            type="button"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed((v) => !v)}
            className="shell__collapse"
            style={{
              left:
                (sidebarExpanded ? WebTokens.sidebarWidth : WebTokens.sidebarRailWidth) - 8,
            }}
          >
            <ChevronLeftRounded
              sx={{ fontSize: 14 }}
              style={{
                transform: collapsed ? 'rotate(180deg)' : 'none',
                transition: 'transform 200ms ease',
              }}
            />
          </button>
        )}
      </div>

      {/* Mobile drawer */}
      {isMobile && drawerOpen && (
        <div className="shell__drawer-scrim" onMouseDown={() => setDrawerOpen(false)}>
          <div
            className="shell__drawer"
            role="dialog"
            aria-label="Navigation"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="shell__drawer-head">
              <Logo />
              <span style={{ flex: 1 }} />
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setDrawerOpen(false)}
                style={{ color: WebTokens.textSecondary, padding: 8, display: 'inline-flex' }}
              >
                <CloseRounded />
              </button>
            </div>
            <div className="divider" />
            <div className="shell__drawer-nav">
              <Sidebar expanded onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Mounted once for the whole portal — every grid opens it through the
          detail store rather than rendering its own copy. */}
      <PredictionDetailPanel />
    </AuroraBackdrop>
  );
}
