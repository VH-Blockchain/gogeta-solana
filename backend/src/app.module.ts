import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AdminModule } from './admin/admin.module';
import { CategoriesModule } from './categories/categories.module';
import { ConfigAppModule } from './config/config.module';
import { EconomyModule } from './economy/economy.module';
import { GamificationModule } from './gamification/gamification.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { MailModule } from './mail/mail.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PredictionsModule } from './predictions/predictions.module';
import { PrismaModule } from './prisma/prisma.module';
import { QuizModule } from './quiz/quiz.module';
import { PointsModule } from './points/points.module';
import { WithdrawalsModule } from './withdrawals/withdrawals.module';
import { PushModule } from './push/push.module';
import { RewardsModule } from './rewards/rewards.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    EconomyModule,
    GamificationModule,
    MailModule,
    PushModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ConfigAppModule,
    PredictionsModule,
    QuizModule,
    PointsModule,
    WithdrawalsModule,
    LeaderboardModule,
    RewardsModule,
    NotificationsModule,
    AdminModule,
    SchedulerModule,
    StorageModule,
  ],
  controllers: [AppController],
  providers: [
    // Auth is global: every route requires a JWT unless marked @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
