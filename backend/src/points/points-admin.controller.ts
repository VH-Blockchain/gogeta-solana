import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PointPurchaseStatus, Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { PointsAdminService } from './points-admin.service';

/**
 * Points-purchase administration. Read routes allow VIEWER, matching
 * admin-predictions.controller.ts.
 *
 * There is deliberately no endpoint to credit or confirm a purchase manually —
 * points come only from verified on-chain payments.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.VIEWER)
@Controller('admin/points')
export class PointsAdminController {
  constructor(private readonly admin: PointsAdminService) {}

  /** Declared before `purchases/:id` so it is not read as an id. */
  @Get('status')
  status() {
    return this.admin.status();
  }

  @Get('purchases')
  list(
    @Query('status') status?: PointPurchaseStatus,
    @Query('search') search?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.admin.listPurchases({ status, search, skip, take });
  }

  @Get('purchases/:id')
  getOne(@Param('id') id: string) {
    return this.admin.getPurchase(id);
  }
}
