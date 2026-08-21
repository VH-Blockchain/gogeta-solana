import { Global, Module } from '@nestjs/common';
import { EconomyService } from './economy.service';
import { DailyBonusService } from './daily-bonus.service';

@Global()
@Module({
  providers: [EconomyService, DailyBonusService],
  exports: [EconomyService, DailyBonusService],
})
export class EconomyModule {}
