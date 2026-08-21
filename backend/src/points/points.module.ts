import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EconomyModule } from '../economy/economy.module';
import { SolanaService } from '../blockchain/solana.service';
import { PointsAdminController } from './points-admin.controller';
import { PointsAdminService } from './points-admin.service';
import { PointsController } from './points.controller';
import { PointsPurchaseService } from './points-purchase.service';

/** Buying points with USDC (SPL) on Solana, plus its admin views. */
@Module({
  imports: [PrismaModule, EconomyModule],
  controllers: [PointsController, PointsAdminController],
  providers: [SolanaService, PointsPurchaseService, PointsAdminService],
  exports: [PointsPurchaseService],
})
export class PointsModule {}
