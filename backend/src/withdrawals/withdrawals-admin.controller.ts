import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, WithdrawalStatus } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  ApproveWithdrawalDto,
  CompleteWithdrawalDto,
  FailWithdrawalDto,
  RejectWithdrawalDto,
} from './dto/withdrawal-admin.dto';
import { WithdrawalsAdminService } from './withdrawals-admin.service';

/**
 * Withdrawal administration.
 *
 * Every decision route is `@Roles(ADMIN)` — a VIEWER can inspect requests but
 * cannot approve, reject or settle one, and a normal user cannot reach any of
 * this at all (§25).
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/withdrawals')
export class WithdrawalsAdminController {
  constructor(private readonly admin: WithdrawalsAdminService) {}

  /** Declared before `:id` so it is not read as a request id. */
  @Roles(Role.ADMIN, Role.VIEWER)
  @Get('status')
  status() {
    return this.admin.status();
  }

  @Roles(Role.ADMIN, Role.VIEWER)
  @Get()
  list(
    @Query('status') status?: WithdrawalStatus,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.admin.list({ status, search, from, to, skip, take });
  }

  @Roles(Role.ADMIN, Role.VIEWER)
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.admin.getOne(id);
  }

  @Post(':id/approve')
  approve(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: ApproveWithdrawalDto,
  ) {
    return this.admin.approve(adminId, id, dto);
  }

  @Post(':id/processing')
  markProcessing(@CurrentUser('id') adminId: string, @Param('id') id: string) {
    return this.admin.markProcessing(adminId, id);
  }

  /** Verifies the payout on-chain, then debits the points. */
  @Post(':id/complete')
  complete(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: CompleteWithdrawalDto,
  ) {
    return this.admin.complete(adminId, id, dto);
  }

  @Post(':id/reject')
  reject(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: RejectWithdrawalDto,
  ) {
    return this.admin.reject(adminId, id, dto);
  }

  @Post(':id/fail')
  fail(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: FailWithdrawalDto,
  ) {
    return this.admin.fail(adminId, id, dto);
  }
}
