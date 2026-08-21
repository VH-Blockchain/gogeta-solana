import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpPurpose } from '@prisma/client';
import { ElasticEmailTransport } from './elastic-email.transport';
import { MailTransport } from './mail-transport.interface';
import { SmtpTransport } from './smtp.transport';

/**
 * OTP mailer. Delivery backend is selected via MAIL_PROVIDER (default
 * "elasticemail"):
 *   - elasticemail: HTTP API v4 over ELASTICEMAIL_API_KEY, MAIL_FROM.
 *   - smtp: nodemailer over SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS, MAIL_FROM.
 *   - sendgrid / resend: not implemented yet — add a MailTransport class
 *     (see elastic-email.transport.ts) and a case below once the client
 *     provides API keys for one of these; no other code needs to change.
 *
 * When no transport can be constructed (unset creds, or an unimplemented
 * provider), the service is disabled and callers fall back to console
 * logging — local dev needs no mail setup.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');
  private readonly transport?: MailTransport;

  constructor(config: ConfigService) {
    const provider = (config.get<string>('MAIL_PROVIDER') ?? 'elasticemail').toLowerCase();

    if (provider === 'elasticemail') {
      const apiKey = config.get<string>('ELASTICEMAIL_API_KEY');
      if (!apiKey) {
        this.logger.warn(
          'ELASTICEMAIL_API_KEY not set — OTP emails disabled (codes logged to console)',
        );
        return;
      }
      // Elastic Email rejects sends from an unverified address, so unlike SMTP
      // there is no authenticated user to fall back to — MAIL_FROM is required.
      const from = config.get<string>('MAIL_FROM');
      if (!from) {
        this.logger.warn('MAIL_FROM not set — OTP emails disabled (codes logged to console)');
        return;
      }
      this.transport = new ElasticEmailTransport({ apiKey, from });
      this.logger.log(`Elastic Email configured — from: ${from}`);
    } else if (provider === 'smtp') {
      const host = config.get<string>('SMTP_HOST');
      const user = config.get<string>('SMTP_USER');
      const pass = config.get<string>('SMTP_PASS');
      if (!host || !user || !pass) {
        this.logger.warn('SMTP not configured — OTP emails disabled (codes logged to console)');
        return;
      }
      const port = Number(config.get('SMTP_PORT') ?? 465);
      const from = config.get<string>('MAIL_FROM') ?? `"GOGETA" <${user}>`;
      this.transport = new SmtpTransport({ host, port, user, pass, from });
      this.logger.log(`SMTP configured: ${host}:${port} as ${user}, from: ${from}`);
    } else {
      this.logger.warn(
        `MAIL_PROVIDER="${provider}" is not implemented yet — OTP emails disabled (codes logged to console)`,
      );
    }
  }

  get enabled(): boolean {
    return this.transport !== undefined;
  }

  /**
   * Sends a diagnostic email to verify the configured provider end-to-end
   * (credentials + verified sender + deliverability). Throws on failure, and
   * returns the transport's message/transaction id on success so the caller
   * can trace it in the provider's activity log.
   */
  async sendTest(to: string): Promise<{ messageId?: string; response?: string }> {
    if (!this.transport) throw new Error('Mail transport not configured');
    const when = new Date().toISOString();
    const intro = 'This is a test email confirming GOGETA mail delivery is working.';
    const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:14px;padding:32px">
        <tr><td align="center" style="padding-bottom:18px">
          <div style="display:inline-block;background:linear-gradient(135deg,#8b5cf6,#22d3ee);color:#ffffff;font-weight:800;font-size:18px;border-radius:10px;padding:8px 14px">⚡ GOGETA</div>
        </td></tr>
        <tr><td style="color:#374151;font-size:15px;line-height:1.6;padding-bottom:12px" align="center">${intro}</td></tr>
        <tr><td style="color:#9ca3af;font-size:12.5px;line-height:1.6" align="center">Sent at ${when}. No action is required.</td></tr>
      </table>
      <div style="color:#9ca3af;font-size:12px;padding-top:16px">© GOGETA · Operated by Yesiki</div>
    </td></tr>
  </table>
</body></html>`;
    return this.transport.send({
      to,
      subject: 'GOGETA test email',
      text: `${intro}\n\nSent at ${when}. No action is required.`,
      html,
    });
  }

  /** Sends an OTP email. Throws on failure so callers can decide how to react. */
  async sendOtp(to: string, code: string, purpose: OtpPurpose): Promise<void> {
    if (!this.transport) throw new Error('Mail transport not configured');
    const isReset = purpose === 'RESET_PASSWORD';
    const subject = isReset
      ? `${code} is your GOGETA password reset code`
      : `${code} is your GOGETA verification code`;
    const intro = isReset
      ? 'Use this code to reset your GOGETA password:'
      : 'Use this code to verify your email address:';
    await this.transport.send({
      to,
      subject,
      text: `${intro} ${code}\n\nThis code expires in a few minutes. If you didn't request it, you can safely ignore this email.`,
      html: this.template(intro, code),
    });
  }

  /** Minimal self-contained HTML that renders well in every mail client. */
  private template(intro: string, code: string): string {
    return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:14px;padding:32px">
        <tr><td align="center" style="padding-bottom:18px">
          <div style="display:inline-block;background:linear-gradient(135deg,#8b5cf6,#22d3ee);color:#ffffff;font-weight:800;font-size:18px;border-radius:10px;padding:8px 14px">⚡ GOGETA</div>
        </td></tr>
        <tr><td style="color:#374151;font-size:15px;line-height:1.6;padding-bottom:16px" align="center">${intro}</td></tr>
        <tr><td align="center" style="padding-bottom:16px">
          <div style="display:inline-block;background:#f4f5f7;border:1px solid #e5e7eb;border-radius:10px;padding:12px 28px;font-size:30px;font-weight:800;letter-spacing:10px;color:#111827">${code}</div>
        </td></tr>
        <tr><td style="color:#9ca3af;font-size:12.5px;line-height:1.6" align="center">
          This code expires in a few minutes.<br>If you didn't request it, you can safely ignore this email.
        </td></tr>
      </table>
      <div style="color:#9ca3af;font-size:12px;padding-top:16px">© GOGETA · Operated by Yesiki</div>
    </td></tr>
  </table>
</body></html>`;
  }
}
