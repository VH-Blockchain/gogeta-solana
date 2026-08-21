import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { WithdrawalsService } from './withdrawals.service';

/**
 * Cashing points out. Authentication is global (JwtAuthGuard in AppModule), and
 * every route scopes to the caller — there is no way to pass a user id, so one
 * user can never touch another's withdrawal (§25).
 */
@ApiTags('withdrawals')
@Controller('withdrawals')
export class WithdrawalsController {
  constructor(private readonly withdrawals: WithdrawalsService) {}

  /**
   * The withdrawable breakdown the UI renders (§27). Computed from the ledger,
   * so the frontend never has to decide eligibility itself.
   */
  @Get('available')
  available(@CurrentUser('id') userId: string) {
    return this.withdrawals.availability(userId);
  }

  @Get()
  history(
    @CurrentUser('id') userId: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.withdrawals.history(userId, { skip, take });
  }

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateWithdrawalDto) {
    return this.withdrawals.create(userId, dto);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.withdrawals.cancel(userId, id);
  }

  /** Declared last so it cannot shadow `available`. */
  @Get(':id')
  getOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.withdrawals.getOne(userId, id);
  }
}
