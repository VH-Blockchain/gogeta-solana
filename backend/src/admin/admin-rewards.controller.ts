import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { ReplaceLuckyWinnerDto } from './dto/replace-lucky-winner.dto';

/** SOW §6 Reward Management: coin allocation lives in Settings (economy.*),
 * distribution happens automatically on resolve — this controller covers the
 * one manual piece: correcting an individual lucky-draw winner afterward. */
@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/lucky-draws')
export class AdminRewardsController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  @Roles(Role.ADMIN, Role.VIEWER)
  list(@Query('take') take?: string) {
    return this.admin.listLuckyDraws({ take });
  }

  @Get(':drawId/eligible')
  @Roles(Role.ADMIN, Role.VIEWER)
  eligible(@Param('drawId') drawId: string) {
    return this.admin.eligibleLuckyReplacements(drawId);
  }

  @Post(':drawId/winners/:winnerId/replace')
  replace(
    @CurrentUser('id') adminId: string,
    @Param('drawId') drawId: string,
    @Param('winnerId') winnerId: string,
    @Body() dto: ReplaceLuckyWinnerDto,
  ) {
    return this.admin.replaceLuckyWinner(drawId, winnerId, dto.newUserId, adminId);
  }
}
