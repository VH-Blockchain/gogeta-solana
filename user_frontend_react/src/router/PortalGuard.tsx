import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Routes } from './routes';
import { setPendingLocation } from './pendingLocation';

/**
 * Guards every portal route: a session is required. Port of the
 * `redirect:` callback in WebRouter.of(auth) for the portal half.
 *
 * While the stored-session check is still in flight we render nothing rather
 * than bouncing a portal deep link to /login — if it turns out there's no
 * valid session, `restoring` flips false, this re-runs and redirects then,
 * instead of flashing /login first and immediately back once the session
 * restores.
 */
export function PortalGuard() {
  const authenticated = useAuthStore((s) => s.authenticated);
  const restoring = useAuthStore((s) => s.restoring);
  const location = useLocation();

  if (restoring) return null;

  if (!authenticated) {
    setPendingLocation(location.pathname + location.search);
    return <Navigate to={Routes.login} replace />;
  }

  return <Outlet />;
}

/**
 * The mirror half of the guard: an already-signed-in visitor on /login or
 * /register bounces into the portal — to the deep-linked page they were
 * originally headed for, else Predict (matching the app's post-login
 * destination, not the Dashboard).
 */
export function useAuthPageRedirect(): string | null {
  const authenticated = useAuthStore((s) => s.authenticated);
  if (!authenticated) return null;
  return Routes.predictions;
}
