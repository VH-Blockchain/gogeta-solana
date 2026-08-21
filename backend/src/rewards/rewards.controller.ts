import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RewardsService, TransactionFilter } from './rewards.service';

@ApiTags('rewards')
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Get('summary')
  getSummary(@CurrentUser('id') userId: string) {
    return this.rewards.getSummary(userId);
  }

  @Get('transactions')
  getTransactions(
    @CurrentUser('id') userId: string,
    @Query('filter') filter?: string,
    @Query('limit') limit?: string,
  ) {
    const allowed: TransactionFilter[] = ['all', 'earned', 'spent'];
    const normalizedFilter = allowed.includes(filter as TransactionFilter)
      ? (filter as TransactionFilter)
      : 'all';

    const parsedLimit = Number(limit);
    const normalizedLimit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(Math.floor(parsedLimit), 200)
        : 50;

    return this.rewards.getTransactions(
      userId,
      normalizedFilter,
      normalizedLimit,
    );
  }
}
