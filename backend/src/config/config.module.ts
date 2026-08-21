import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CategoriesModule } from '../categories/categories.module';
import { ConfigController } from './config.controller';
import { PublicContentController } from './public-content.controller';

@Module({
  imports: [CategoriesModule, AuthModule],
  controllers: [ConfigController, PublicContentController],
})
export class ConfigAppModule {}
