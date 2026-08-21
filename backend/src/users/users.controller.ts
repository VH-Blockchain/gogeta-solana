import { Body, Controller, Delete, Get, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PushService } from '../push/push.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RegisterDeviceTokenDto, UnregisterDeviceTokenDto } from './dto/device-token.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly push: PushService,
  ) {}

  @Get('me')
  getMe(@CurrentUser('id') userId: string) {
    return this.users.getMe(userId);
  }

  /** Called by the app only on a genuine app-open (cold start / resume from
   *  background) — never on a plain profile refresh. See UsersService.notifyAppOpened. */
  @Post('me/app-open')
  appOpened(@CurrentUser('id') userId: string) {
    return this.users.notifyAppOpened(userId);
  }

  @Patch('me')
  updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.users.updateProfile(userId, dto);
  }

  @Delete('me')
  deleteMe(@CurrentUser('id') userId: string) {
    return this.users.deleteAccount(userId);
  }

  @Patch('me/password')
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.users.changePassword(userId, dto);
  }

  @Get('me/stats')
  getStats(@CurrentUser('id') userId: string) {
    return this.users.getStats(userId);
  }

  @Get('me/badges')
  getBadges(@CurrentUser('id') userId: string) {
    return this.users.getBadges(userId);
  }

  @Get('me/home')
  getHome(@CurrentUser('id') userId: string) {
    return this.users.getHome(userId);
  }

  @Get('me/trends')
  getTrends(
    @CurrentUser('id') userId: string,
    @Query('days') days?: string,
  ) {
    const n = Number(days);
    return this.users.getTrends(userId, Number.isFinite(n) && n > 0 ? n : 8);
  }

  @Get('me/settings')
  getSettings(@CurrentUser('id') userId: string) {
    return this.users.getSettings(userId);
  }

  @Patch('me/settings')
  updateSettings(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.users.updateSettings(userId, dto);
  }

  /** Registers/refreshes this device's push token (call on login and on FCM token refresh). */
  @Post('me/device-token')
  registerDeviceToken(
    @CurrentUser('id') userId: string,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    return this.push.registerToken(userId, dto.token, dto.platform);
  }

  /** Removes this device's push token (call on logout so a signed-out device stops receiving pushes). */
  @Delete('me/device-token')
  unregisterDeviceToken(@Body() dto: UnregisterDeviceTokenDto) {
    return this.push.unregisterToken(dto.token);
  }
}
