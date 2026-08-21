import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { MailMessage, MailSendResult, MailTransport } from './mail-transport.interface';

export interface SmtpTransportConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export class SmtpTransport implements MailTransport {
  private readonly logger = new Logger('Mail:SMTP');
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(config: SmtpTransportConfig) {
    this.from = config.from;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465, // 465 = implicit TLS, 587 = STARTTLS
      auth: { user: config.user, pass: config.pass },
    });
  }

  async send(message: MailMessage): Promise<MailSendResult> {
    const info = await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    // info.response carries the server's queue id (e.g. "250 OK id=1aBcD-...")
    // — search that id in the mail host's Track Delivery / exim log to see the
    // message's final delivery status.
    this.logger.log(`sent to ${message.to} — accepted: ${info.response} messageId: ${info.messageId}`);
    return { messageId: info.messageId, response: info.response };
  }
}
