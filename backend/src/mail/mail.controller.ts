import { Body, Controller, Post, ServiceUnavailableException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { TestMailDto } from './dto/test-mail.dto';
import { MailService } from './mail.service';

async function sendTestMail(mail: MailService, to: string) {
  if (!mail.enabled) {
    throw new ServiceUnavailableException(
      'Mail is not configured — check MAIL_PROVIDER and provider credentials.',
    );
  }
  const result = await mail.sendTest(to);
  return { ok: true, to, ...result };
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/mail')
export class MailController {
  constructor(private readonly mail: MailService) {}

  /**
   * Sends a diagnostic email via the configured provider to verify credentials,
   * the verified sender, and deliverability. Admin-only — it triggers a real
   * outbound send.
   */
  @Post('test')
  test(@Body() dto: TestMailDto) {
    return sendTestMail(this.mail, dto.to);
  }
}

/**
 * Unauthenticated variant of the test-mail endpoint, for quickly checking the
 * mail provider without an admin JWT. It triggers a real outbound send, so keep
 * it OUT of production (or remove it) once the provider is verified.
 */
@ApiTags('mail')
@Controller('mail')
export class PublicMailController {
  constructor(private readonly mail: MailService) {}

  @Public()
  @Post('test')
  test(@Body() dto: TestMailDto) {
    return sendTestMail(this.mail, dto.to);
  }
}
