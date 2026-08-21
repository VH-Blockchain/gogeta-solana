import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { UpdateSettingDto } from './dto/setting.dto';
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto';
import { CreateCmsPageDto, UpdateCmsPageDto } from './dto/cms.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminContentController {
  constructor(private readonly admin: AdminService) {}

  // ── Analytics ──
  @Get('analytics')
  @Roles(Role.ADMIN, Role.VIEWER)
  analytics() {
    return this.admin.analytics();
  }

  @Get('analytics/closed-predictions')
  @Roles(Role.ADMIN, Role.VIEWER)
  closedPredictionAnalytics(@Query('take') take?: string, @Query('days') days?: string) {
    return this.admin.closedPredictionAnalytics({ take, days });
  }

  // ── Settings ──
  @Get('settings')
  @Roles(Role.ADMIN, Role.VIEWER)
  listSettings() {
    return this.admin.listSettings();
  }

  @Put('settings/:key')
  upsertSetting(
    @CurrentUser('id') adminId: string,
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
  ) {
    return this.admin.upsertSetting(key, dto.value, adminId);
  }

  // ── Banners ──
  @Get('banners')
  @Roles(Role.ADMIN, Role.VIEWER)
  listBanners() {
    return this.admin.listBanners();
  }

  @Post('banners')
  createBanner(@Body() dto: CreateBannerDto) {
    return this.admin.createBanner(dto);
  }

  @Patch('banners/:id')
  updateBanner(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.admin.updateBanner(id, dto);
  }

  @Delete('banners/:id')
  deleteBanner(@Param('id') id: string) {
    return this.admin.deleteBanner(id);
  }

  // ── CMS ──
  @Get('cms')
  @Roles(Role.ADMIN, Role.VIEWER)
  listCms() {
    return this.admin.listCmsPages();
  }

  @Post('cms')
  createCms(@Body() dto: CreateCmsPageDto) {
    return this.admin.createCmsPage(dto);
  }

  @Patch('cms/:id')
  updateCms(@Param('id') id: string, @Body() dto: UpdateCmsPageDto) {
    return this.admin.updateCmsPage(id, dto);
  }
}
