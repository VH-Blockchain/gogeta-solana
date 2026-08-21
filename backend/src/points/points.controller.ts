import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ConfirmPurchaseDto } from './dto/confirm-purchase.dto';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PointsPurchaseService } from './points-purchase.service';

/**
 * Buying points with USDC. Authentication is global (JwtAuthGuard in
 * AppModule), so every route here already has a session.
 */
@ApiTags('points')
@Controller('points')
export class PointsController {
  constructor(private readonly purchases: PointsPurchaseService) {}

  /** Network, token, rate and bounds for the Buy Points flow. */
  @Get('purchase-config')
  purchaseConfig() {
    return this.purchases.config();
  }

  @Get('balance')
  balance(@CurrentUser('id') userId: string) {
    return this.purchases.balance(userId);
  }

  @Get('purchases')
  history(
    @CurrentUser('id') userId: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.purchases.history(userId, { skip, take });
  }

  /** Step 1: the server fixes the amount, rate and points before any signing. */
  @Post('purchase/create')
  create(@CurrentUser('id') userId: string, @Body() dto: CreatePurchaseDto) {
    return this.purchases.createIntent(userId, dto);
  }

  /**
   * Step 2: hand over the transaction hash. The server verifies it against Solana
   * and credits only what was actually paid.
   */
  @Post('purchase/:id/confirm')
  confirm(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: ConfirmPurchaseDto,
  ) {
    return this.purchases.confirm(userId, id, dto);
  }

  @Post('purchase/:id/cancel')
  cancel(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.purchases.cancel(userId, id);
  }

  /** Declared last so it cannot shadow the routes above. */
  @Get('purchase/:id')
  getOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.purchases.getOne(userId, id);
  }
}
