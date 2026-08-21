import { Module } from '@nestjs/common';
import { EconomyModule } from '../economy/economy.module';
import {
  QuizAdminController,
  QuizQuestionsAdminController,
} from './quiz-admin.controller';
import { QuizAdminService } from './quiz-admin.service';
import { QuizConfigService } from './quiz-config.service';
import { QuizController } from './quiz.controller';
import { QuizService } from './quiz.service';

@Module({
  imports: [EconomyModule],
  controllers: [
    QuizController,
    QuizAdminController,
    QuizQuestionsAdminController,
  ],
  providers: [QuizService, QuizAdminService, QuizConfigService],
  exports: [QuizService, QuizConfigService],
})
export class QuizModule {}
