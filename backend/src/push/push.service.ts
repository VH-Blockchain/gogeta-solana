import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, cert, initializeApp, ServiceAccount } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { PrismaService } from '../prisma/prisma.service';

export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Mobile push via Firebase Cloud Messaging. Configured from
 * FIREBASE_SERVICE_ACCOUNT (a stringified service-account JSON, same
 * single-env-var pattern as SMTP/mail). When unset, push is disabled and
 * callers no-op — local dev needs no Firebase project.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger('Push');
  private app?: App;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const raw = config.get<string>('FIREBASE_SERVICE_ACCOUNT');
    if (!raw) {
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT not configured — push notifications disabled');
      return;
    }
    try {
      const credentials = JSON.parse(raw) as ServiceAccount;
      this.app = initializeApp({ credential: cert(credentials) });
      this.logger.log('Firebase Admin initialized — push notifications enabled');
    } catch (err) {
      this.logger.error(`Invalid FIREBASE_SERVICE_ACCOUNT JSON: ${String(err)}`);
    }
  }

  get enabled(): boolean {
    return this.app !== undefined;
  }

  /** Registers/refreshes a device's push token (one row per token, re-upserts on relogin). */
  async registerToken(userId: string, token: string, platform: string) {
    await this.prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
    return { registered: true };
  }

  /** Removes a device's push token (call on logout so a signed-out device stops receiving pushes). */
  async unregisterToken(token: string) {
    await this.prisma.deviceToken.deleteMany({ where: { token } });
    return { unregistered: true };
  }

  /** Sends to every device registered to one user. Best-effort — never throws. */
  async sendToUser(userId: string, notification: PushNotification): Promise<void> {
    return this.sendToUsers([userId], notification);
  }

  /** Sends to every device registered to any of these users, batched to FCM's 500-token limit. */
  async sendToUsers(userIds: string[], notification: PushNotification): Promise<void> {
    if (!this.app || userIds.length === 0) return;
    try {
      const tokens = await this.prisma.deviceToken.findMany({
        where: { userId: { in: userIds } },
        select: { token: true },
      });
      if (tokens.length === 0) return;

      const messaging = getMessaging(this.app);
      const chunks: string[][] = [];
      for (let i = 0; i < tokens.length; i += 500) {
        chunks.push(tokens.slice(i, i + 500).map((t) => t.token));
      }

      const invalid: string[] = [];
      for (const chunk of chunks) {
        const res = await messaging.sendEachForMulticast({
          tokens: chunk,
          notification: { title: notification.title, body: notification.body },
          data: notification.data,
          // Explicit per-platform sound/channel — without these, whether a
          // sound plays is left to OS/device defaults, which is inconsistent
          // across devices. Device-level silent mode/DND still overrides this.
          android: { notification: { sound: 'default', channelId: 'predora_default' } },
          apns: { payload: { aps: { sound: 'default' } } },
        });
        res.responses.forEach((r, i) => {
          const shortToken = `${chunk[i].slice(0, 12)}...`;
          if (r.success) {
            this.logger.log(`sent to ${shortToken} — messageId: ${r.messageId}`);
          } else {
            this.logger.warn(
              `send FAILED to ${shortToken} — code: ${r.error?.code} — ${r.error?.message}`,
            );
          }
          const code = r.error?.code;
          if (
            !r.success &&
            (code === 'messaging/invalid-registration-token' ||
              code === 'messaging/registration-token-not-registered')
          ) {
            invalid.push(chunk[i]);
          }
        });
      }
      // Devices that uninstalled the app or cleared its data — stop
      // targeting them instead of retrying every time.
      if (invalid.length) {
        await this.prisma.deviceToken.deleteMany({ where: { token: { in: invalid } } });
      }
    } catch (err) {
      this.logger.error(`Push send failed: ${String(err)}`);
    }
  }
}
