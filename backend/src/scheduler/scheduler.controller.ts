import { BadRequestException, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LeaderboardPeriod, Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { SchedulerService } from './scheduler.service';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/leaderboard')
export class SchedulerController {
  constructor(
    private readonly scheduler: SchedulerService,
    private readonly prisma: PrismaService,
  ) {}

  /** Manually run a period close (snapshot + badges + levels). */
  @Post('close/:period')
  close(@Param('period') period: string) {
    switch (period) {
      case 'daily':
        return this.scheduler.closeDaily();
      case 'weekly':
        return this.scheduler.closeWeekly();
      case 'monthly':
        return this.scheduler.closeMonthly();
      default:
        throw new BadRequestException('period must be daily | weekly | monthly');
    }
  }

  /** Historical leaderboard snapshots (SOW: view historical reports). */
  @Get('snapshots')
  snapshots(@Query('period') period?: string) {
    const where =
      period && ['DAILY', 'WEEKLY', 'MONTHLY'].includes(period.toUpperCase())
        ? { period: period.toUpperCase() as LeaderboardPeriod }
        : {};
    return this.prisma.leaderboardSnapshot.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 60,
    });
  }
}
