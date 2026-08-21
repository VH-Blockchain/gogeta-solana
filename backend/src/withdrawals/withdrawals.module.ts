import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EconomyModule } from '../economy/economy.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SolanaService } from '../blockchain/solana.service';
import { WithdrawalsAdminController } from './withdrawals-admin.controller';
import { WithdrawalsAdminService } from './withdrawals-admin.service';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsService } from './withdrawals.service';

/** Cashing points out for stablecoin, plus its admin review flow. */
@Module({
  imports: [PrismaModule, EconomyModule, NotificationsModule],
  controllers: [WithdrawalsController, WithdrawalsAdminController],
  providers: [SolanaService, WithdrawalsService, WithdrawalsAdminService],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
