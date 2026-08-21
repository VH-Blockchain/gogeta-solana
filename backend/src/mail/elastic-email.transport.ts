import { Logger } from '@nestjs/common';
import { MailMessage, MailSendResult, MailTransport } from './mail-transport.interface';

export interface ElasticEmailTransportConfig {
  apiKey: string;
  /** "Name <address>" or a bare address; the display name (if any) is split
   *  out and sent as Elastic Email's separate `fromName` field. */
  from: string;
  /** Overridable for tests; defaults to Elastic Email's public API. */
  baseUrl?: string;
  timeoutMs?: number;
}

// v2 responses are { success: bool, data?: {...}, error?: string }.
interface ElasticEmailV2Response {
  success: boolean;
  error?: string;
  data?: { messageid?: string; transactionid?: string };
}

/** Splits `"GOGETA" <no-reply@x.com>` into { name: "GOGETA", email: "no-reply@x.com" }.
 *  A bare address returns an empty name. */
function parseFrom(from: string): { name: string; email: string } {
  const match = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1].replace(/^"|"$/g, '').trim(), email: match[2].trim() };
  }
  return { name: '', email: from.trim() };
}

/**
 * Elastic Email delivery over the classic HTTP v2 API
 * (POST /v2/email/send, application/x-www-form-urlencoded, apikey as a field).
 * isTransactional=true so OTP mail bypasses list/unsubscribe handling — a
 * suppressed or unsubscribed address must still receive its login code.
 */
export class ElasticEmailTransport implements MailTransport {
  private readonly logger = new Logger('Mail:ElasticEmail');
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: ElasticEmailTransportConfig) {
    this.apiKey = config.apiKey;
    const { name, email } = parseFrom(config.from);
    this.fromEmail = email;
    this.fromName = name;
    this.baseUrl = (config.baseUrl ?? 'https://api.elasticemail.com/v2').replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs ?? 15_000;
  }

  async send(message: MailMessage): Promise<MailSendResult> {
    const form = new URLSearchParams({
      apikey: this.apiKey,
      from: this.fromEmail,
      to: message.to,
      subject: message.subject,
      bodyHtml: message.html,
      bodyText: message.text,
      isTransactional: 'true',
    });
    if (this.fromName) form.set('fromName', this.fromName);

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      console.log(res,"res");
    } catch (err) {
      // Network error / timeout: no HTTP status to report.
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(`Elastic Email request failed: ${reason}`);
    }

    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 500);
      throw new Error(`Elastic Email send failed: HTTP ${res.status} ${res.statusText} ${detail}`);
    }

    // v2 returns HTTP 200 even on logical failure — success is in the body.
    const json = (await res.json().catch(() => null)) as ElasticEmailV2Response | null;
    if (!json?.success) {
      throw new Error(`Elastic Email send rejected: ${json?.error ?? 'unknown error'}`);
    }

    // transactionid identifies the send in Elastic Email's Activity/Logs UI;
    // search it there to see the message's final delivery status.
    this.logger.log(
      `sent to ${message.to} — messageId: ${json.data?.messageid} transactionId: ${json.data?.transactionid}`,
    );
    return { messageId: json.data?.messageid, response: json.data?.transactionid };
  }
}
