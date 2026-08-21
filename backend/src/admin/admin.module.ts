import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminPredictionsController } from './admin-predictions.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminContentController } from './admin-content.controller';
import { AdminCategoriesController } from './admin-categories.controller';
import { AdminSystemController } from './admin-system.controller';
import { AdminRewardsController } from './admin-rewards.controller';
import { UploadController } from './upload.controller';

/**
 * Admin module. PrismaService, EconomyService and GamificationService are all
 * provided by @Global modules, so only the AdminService is registered here.
 */
@Module({
  controllers: [
    AdminPredictionsController,
    AdminUsersController,
    AdminContentController,
    AdminCategoriesController,
    AdminSystemController,
    AdminRewardsController,
    UploadController,
  ],
  providers: [AdminService],
})
export class AdminModule {}
