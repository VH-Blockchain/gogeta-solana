import { useEffect, useRef } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { setUpWebPushNavigation } from '@/core/push/webPushNavigation';
import { registerPushToken } from '@/core/push/pushRegistration';
import { AppRouter } from '@/router/AppRouter';
import { useAuthStore } from '@/store/authStore';
import { useConfigStore } from '@/store/configStore';
import { useThemeStore } from '@/store/themeStore';
import { WebTokens } from '@/theme/webTokens';
import { ToastHost } from '@/components/Toast';
import { Web3Provider } from '@/core/web3/Web3Provider';

/**
 * Root of the web portal. Mounts the guarded router immediately and restores
 * any stored session in the background — the router must mount right away, or a
 * splash screen would reset the browser URL and lose deep links / reloads.
 *
 * While the session restores, a full-screen loader covers the brief
 * stored-session check so a portal deep link or refresh shows a plain loader
 * instead of the login screen or a half-mounted shell before the guard has
 * settled on where it actually belongs.
 *
 * Port of `IkiWebApp`/`_WebRoot`.
 */
export function App() {
  const restoring = useAuthStore((s) => s.restoring);
  const authenticated = useAuthStore((s) => s.authenticated);
  const isDark = useThemeStore((s) => s.isDark);
  const wasAuthenticated = useRef(false);

  useEffect(() => {
    setUpWebPushNavigation();
    void useAuthStore.getState().tryAutoLogin();
    // The public config drives site name/logo/lucky-draw copy on the landing
    // page too, so it's fetched before (and independently of) any session.
    void useConfigStore.getState().load();
  }, []);

  /**
   * A single choke point for push registration — covers both a fresh
   * login/register/OTP-verify and a session restored on page load, without
   * needing every auth screen to remember to call this individually.
   */
  useEffect(() => {
    if (authenticated && !wasAuthenticated.current) void registerPushToken();
    wasAuthenticated.current = authenticated;
  }, [authenticated]);

  return (
    // Web3Provider wraps the router so a wallet connection survives navigation
    // between pages.
    <Web3Provider>
    <BrowserRouter>
      <AppRouter />
      <ToastHost />
      {restoring && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 3000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isDark ? WebTokens.bg : WebTokens.lightBg,
          }}
        >
          <span
            aria-label="Loading"
            role="status"
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              border: `3px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'}`,
              borderTopColor: isDark ? 'rgba(255,255,255,0.7)' : WebTokens.accentDeep,
              animation: 'glow-btn-spin 800ms linear infinite',
            }}
          />
        </div>
      )}
    </BrowserRouter>
    </Web3Provider>
  );
}
