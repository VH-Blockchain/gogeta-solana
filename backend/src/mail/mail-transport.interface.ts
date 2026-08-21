export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailSendResult {
  messageId?: string;
  response?: string;
}

/**
 * Swappable mail delivery backend. `MailService` builds the OTP subject/body
 * and hands it to whichever transport `MAIL_PROVIDER` selects — switching
 * providers (e.g. SMTP → SendGrid/Resend once the client supplies API keys)
 * only means adding a new class here and a case in MailService's factory,
 * no changes to OTP/auth business logic.
 */
export interface MailTransport {
  send(message: MailMessage): Promise<MailSendResult>;
}
