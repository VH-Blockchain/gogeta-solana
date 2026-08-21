import { PushNotifications } from './pushNotifications';
import { toast } from '@/hooks/useToast';

/**
 * The navigate function the app's router provides, captured once the router
 * mounts — push handlers fire from outside React's tree, so they can't use a
 * hook.
 */
let navigateFn: ((path: string) => void) | null = null;
let initialized = false;

export function setPushNavigator(navigate: (path: string) => void): void {
  navigateFn = navigate;
}

/**
 * Wires foreground push handling. Browsers never show a native banner for a
 * focused tab, so this surfaces an in-app toast instead, with a "View" action
 * that routes to the relevant page. Background pushes are handled by the
 * service worker (public/firebase-messaging-sw.js), which owns its own
 * tap-to-route mapping.
 *
 * Port of `setUpWebPushNavigation`.
 */
export function setUpWebPushNavigation(): void {
  if (initialized) return;
  initialized = true;

  PushNotifications.listenForeground((message) => {
    const notification = message.notification;
    if (!notification) return;
    const text = notification.body
      ? `${notification.title}\n${notification.body}`
      : (notification.title ?? '');
    toast(text, {
      durationMs: 6000,
      action: {
        label: 'View',
        onPress: () => navigateForWebPushType(message.data?.type),
      },
    });
  });
}

/**
 * Routes to the relevant portal page for a push's `type` (set server-side in
 * admin.service.ts's resolvePrediction/broadcast) — the portal has no dedicated
 * history page, so RESULT lands on Predictions instead.
 */
export function navigateForWebPushType(type?: string): void {
  if (!navigateFn) return;
  switch (type) {
    case 'LUCKY':
      navigateFn('/leaderboard/lucky');
      break;
    case 'RESULT':
      navigateFn('/predictions');
      break;
    case 'SYSTEM':
      navigateFn('/notifications');
      break;
    default:
      navigateFn('/dashboard');
  }
}
