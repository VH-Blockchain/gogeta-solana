import { UserRepository } from '@/data/api/userRepository';
import { PushNotifications } from './pushNotifications';

/**
 * Requests permission, gets this browser's FCM token, and registers it with
 * the backend. Call after any successful login/registration/session-restore.
 *
 * Best-effort: never throws — a push-registration failure must not block
 * sign-in.
 */
export async function registerPushToken(): Promise<void> {
  try {
    const token = await PushNotifications.requestPermissionAndGetToken();
    if (!token) return;
    await UserRepository.registerDeviceToken(token, 'web');
  } catch {
    // Best-effort — see doc comment above.
  }
}

/**
 * Unregisters this browser's current FCM token — call right before clearing
 * the local session on logout, so a signed-out browser stops receiving
 * pushes meant for whoever signs in next on it.
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    const token = await PushNotifications.getToken();
    if (token) await UserRepository.unregisterDeviceToken(token);
  } catch {
    // Best-effort — see doc comment above.
  }
}
