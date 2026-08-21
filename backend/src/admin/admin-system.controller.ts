import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { BroadcastDto } from './dto/broadcast.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminSystemController {
  constructor(private readonly admin: AdminService) {}

  /** Sends an in-app announcement to every active user. */
  @Post('notifications/broadcast')
  broadcast(@CurrentUser('id') adminId: string, @Body() dto: BroadcastDto) {
    return this.admin.broadcast(adminId, dto);
  }

  /** Recent admin activity (audit log). */
  @Get('audit-log')
  @Roles(Role.ADMIN, Role.VIEWER)
  auditLog(@Query('take') take?: string) {
    return this.admin.auditLog({ take });
  }
}
