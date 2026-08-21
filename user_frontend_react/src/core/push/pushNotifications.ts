import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type MessagePayload,
  type Messaging,
} from 'firebase/messaging';
import { firebaseConfig, webPushVapidKey } from './firebaseConfig';

/**
 * Browser notification permission, mirroring Firebase's AuthorizationStatus
 * so the UI's three-way switch (on / blocked / not asked) ports directly.
 */
export type AuthorizationStatus = 'authorized' | 'denied' | 'notDetermined' | 'provisional';

/**
 * Push notifications via Firebase Cloud Messaging (browser push via a
 * service worker; see public/firebase-messaging-sw.js).
 *
 * Every method is a safe no-op until Firebase initialises successfully —
 * `tryInitializeFirebase` swallows the failure so the app boots normally
 * either way. This lets the rest of the app wire push unconditionally.
 */
class PushNotificationsImpl {
  private app: FirebaseApp | null = null;
  private messaging: Messaging | null = null;
  private ready = false;
  private error: unknown = null;

  /** Call once, early in boot before rendering. Never throws. */
  async tryInitializeFirebase(): Promise<void> {
    try {
      // Messaging needs a service worker and a secure context; both are
      // absent in some environments (plain http on a LAN IP, some embedded
      // webviews), where getMessaging() throws.
      if (!('serviceWorker' in navigator) || !(await isSupported())) {
        this.error = new Error('Messaging unsupported in this browser context');
        return;
      }
      this.app = initializeApp(firebaseConfig);
      this.messaging = getMessaging(this.app);
      this.ready = true;
    } catch (e) {
      // Push stays disabled; everything else about the app works normally.
      this.error = e;
      console.warn('Firebase not configured, push notifications disabled:', e);
    }
  }

  get isReady(): boolean {
    return this.ready;
  }

  /**
   * Why tryInitializeFirebase didn't reach ready, if it didn't — surfaced in
   * UI for diagnosing setup issues since console output isn't always visible.
   */
  get initError(): unknown {
    return this.error;
  }

  /**
   * The browser's current notification permission for this origin — drives
   * whether UI shows "Enable notifications" vs. an already-on state, WITHOUT
   * prompting.
   */
  async permissionStatus(): Promise<AuthorizationStatus> {
    if (!this.ready || typeof Notification === 'undefined') return 'notDetermined';
    switch (Notification.permission) {
      case 'granted':
        return 'authorized';
      case 'denied':
        return 'denied';
      default:
        return 'notDetermined';
    }
  }

  /**
   * Requests permission (a real browser prompt) and returns this browser's
   * current FCM token, or null if unavailable/denied/unconfigured.
   *
   * MUST be called from a direct user gesture — browsers (Safari in
   * particular) silently ignore a permission request that isn't, which is
   * why this can't fire automatically after login.
   */
  async requestPermissionAndGetToken(): Promise<string | null> {
    if (!this.ready || !this.messaging) return null;
    if (!webPushVapidKey) return null;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return null;
      const registration = await navigator.serviceWorker.getRegistration(
        '/firebase-cloud-messaging-push-scope',
      );
      return await getToken(this.messaging, {
        vapidKey: webPushVapidKey,
        serviceWorkerRegistration: registration,
      });
    } catch (e) {
      console.warn('Could not obtain a push token:', e);
      return null;
    }
  }

  /**
   * This browser's current token without prompting again — for logout, where
   * we just need whatever token is already registered.
   */
  async getToken(): Promise<string | null> {
    if (!this.ready || !this.messaging || !webPushVapidKey) return null;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return null;
    try {
      const registration = await navigator.serviceWorker.getRegistration(
        '/firebase-cloud-messaging-push-scope',
      );
      return await getToken(this.messaging, {
        vapidKey: webPushVapidKey,
        serviceWorkerRegistration: registration,
      });
    } catch {
      return null;
    }
  }

  /**
   * Messages that arrive while the tab is focused — the browser does not
   * show a system notification for these on its own.
   */
  listenForeground(onPush: (message: MessagePayload) => void): void {
    if (!this.ready || !this.messaging) return;
    onMessage(this.messaging, onPush);
  }
}

export const PushNotifications = new PushNotificationsImpl();
export type { MessagePayload };
