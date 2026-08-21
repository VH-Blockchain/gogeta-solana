import { Global, Module } from '@nestjs/common';
import { MailController, PublicMailController } from './mail.controller';
import { MailService } from './mail.service';

@Global()
@Module({
  controllers: [MailController, PublicMailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
