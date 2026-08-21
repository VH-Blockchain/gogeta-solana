import { useAuthStore } from '@/store/authStore';
import { useBasketStore } from '@/store/basketStore';
import { useNotificationsStore } from '@/store/notificationsStore';
import { usePredictionsStore } from '@/store/predictionsStore';
import { usePointsStore } from '@/store/pointsStore';
import { useQuizStore } from '@/store/quizStore';
import { unregisterPushToken } from './pushRegistration';

/**
 * The one correct way to log out: unregister this browser's push token while
 * the auth token is still valid, clear the pending pick basket and cached
 * feeds, then clear the session. Every "Sign out" button must call this — a
 * bare navigate() looks like it works but leaves the session and push
 * registration intact.
 *
 * The router guard redirects to /login on the auth change, so there's no
 * navigation step here.
 *
 * Clearing the basket matters because it's plain in-memory state on a store
 * that outlives the auth session (the app doesn't fully remount on logout) —
 * without this an unsubmitted pick would survive into the next signed-in
 * session, including a different user's on a shared browser, showing
 * "N picks selected" with no way to tell which question it was for.
 */
export async function performWebLogout(): Promise<void> {
  await unregisterPushToken();
  useBasketStore.getState().clear();
  usePredictionsStore.getState().reset();
  useQuizStore.getState().reset();
  usePointsStore.getState().reset();
  useNotificationsStore.getState().reset();
  await useAuthStore.getState().logout();
}
