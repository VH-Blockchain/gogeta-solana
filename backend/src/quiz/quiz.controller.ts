import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { QuizCategory } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { QuizService } from './quiz.service';

/**
 * Player-facing quiz endpoints. Authentication is global (see the JwtAuthGuard
 * registered in AppModule), so every route here already requires a session.
 */
@ApiTags('quiz')
@Controller('quiz')
export class QuizController {
  constructor(private readonly quiz: QuizService) {}

  /** Landing page: the four categories, their pool sizes and the next session. */
  @Get('categories')
  categories(@CurrentUser('id') userId: string) {
    return this.quiz.categories(userId);
  }

  /** The session the user is currently playing, if any (also covers a refresh). */
  @Get('current')
  current(@CurrentUser('id') userId: string) {
    return this.quiz.current(userId);
  }

  /** The next joinable session for a category. */
  @Get('next')
  next(
    @CurrentUser('id') userId: string,
    @Query('category') category: QuizCategory,
  ) {
    return this.quiz.next(userId, category);
  }

  @Get('history')
  history(
    @CurrentUser('id') userId: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.quiz.history(userId, { skip, take });
  }

  /**
   * Declared before `:quizId/...` routes so "history" can never be captured as
   * a quiz id by the router.
   */
  @Get('history/:participationId')
  historyDetail(
    @CurrentUser('id') userId: string,
    @Param('participationId') participationId: string,
  ) {
    return this.quiz.historyDetail(userId, participationId);
  }

  @Post(':quizId/join')
  join(
    @CurrentUser('id') userId: string,
    @CurrentUser('email') email: string,
    @Param('quizId') quizId: string,
  ) {
    return this.quiz.join(userId, email, quizId);
  }

  /** The currently open question — never includes the correct answer. */
  @Get(':quizId/question')
  question(@CurrentUser('id') userId: string, @Param('quizId') quizId: string) {
    return this.quiz.currentQuestion(userId, quizId);
  }

  @Post(':quizId/answer')
  answer(
    @CurrentUser('id') userId: string,
    @Param('quizId') quizId: string,
    @Body() dto: SubmitAnswerDto,
  ) {
    return this.quiz.answer(userId, quizId, dto);
  }

  /** Grades on demand (idempotently) and returns the full breakdown. */
  @Get(':quizId/result')
  result(@CurrentUser('id') userId: string, @Param('quizId') quizId: string) {
    return this.quiz.result(userId, quizId);
  }
}
