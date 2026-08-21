import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  LeaderboardPeriodParam,
  LeaderboardService,
} from './leaderboard.service';

@ApiTags('leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Get()
  getLeaderboard(
    @CurrentUser('id') userId: string,
    @Query('period') period?: string,
  ) {
    const allowed: LeaderboardPeriodParam[] = ['daily', 'weekly', 'monthly'];
    const normalized = allowed.includes(period as LeaderboardPeriodParam)
      ? (period as LeaderboardPeriodParam)
      : 'daily';
    return this.leaderboard.getLeaderboard(normalized, userId);
  }

  @Get('lucky-winners/today')
  getTodayLuckyWinners(@CurrentUser('id') userId: string) {
    return this.leaderboard.getTodayLuckyWinners(userId);
  }
}
