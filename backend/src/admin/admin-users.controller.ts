import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { ListUsersDto } from './dto/list-users.dto';
import { AdjustCoinsDto } from './dto/adjust-coins.dto';
import { SetRoleDto } from './dto/set-role.dto';
import { SuspendDto } from './dto/suspend.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  @Roles(Role.ADMIN, Role.VIEWER)
  list(@Query() query: ListUsersDto) {
    return this.admin.listUsers(query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.VIEWER)
  getOne(@Param('id') id: string) {
    return this.admin.getUser(id);
  }

  @Get(':id/ledger')
  @Roles(Role.ADMIN, Role.VIEWER)
  ledger(@Param('id') id: string, @Query('take') take?: string) {
    return this.admin.getUserLedger(id, { take });
  }

  @Get(':id/entries')
  @Roles(Role.ADMIN, Role.VIEWER)
  entries(@Param('id') id: string, @Query('take') take?: string) {
    return this.admin.getUserEntries(id, { take });
  }

  @Post(':id/role')
  setRole(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: SetRoleDto,
  ) {
    return this.admin.setUserRole(adminId, id, dto.role);
  }

  @Post(':id/adjust-coins')
  adjustCoins(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: AdjustCoinsDto,
  ) {
    return this.admin.adjustCoins(adminId, id, dto);
  }

  @Post(':id/suspend')
  suspend(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: SuspendDto,
  ) {
    return this.admin.suspendUser(adminId, id, dto);
  }

  @Post(':id/force-verify')
  forceVerify(@CurrentUser('id') adminId: string, @Param('id') id: string) {
    return this.admin.forceVerifyUser(adminId, id);
  }
}
