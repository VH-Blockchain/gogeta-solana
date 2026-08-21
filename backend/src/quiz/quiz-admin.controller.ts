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
import { QuizCategory, QuizStatus, Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CreateQuizQuestionDto,
  SetQuestionStatusDto,
  UpdateQuizQuestionDto,
} from './dto/quiz-question.dto';
import { UpdateQuizSettingsDto } from './dto/quiz-settings.dto';
import { QuizAdminService } from './quiz-admin.service';

/**
 * Quiz session management + configuration for the admin panel.
 *
 * Lives in the quiz module rather than AdminService (already ~2.5k lines) but
 * follows the same conventions: an `admin/`-prefixed route guarded by @Roles.
 * SchedulerController does exactly this for `admin/leaderboard`.
 *
 * Read routes also allow VIEWER, matching admin-predictions.controller.ts.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/quizzes')
export class QuizAdminController {
  constructor(private readonly admin: QuizAdminService) {}

  @Roles(Role.ADMIN, Role.VIEWER)
  @Get()
  list(
    @Query('category') category?: QuizCategory,
    @Query('status') status?: QuizStatus,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.admin.listQuizzes({ category, status, skip, take });
  }

  /** Declared before `:id` so it is not swallowed as a quiz id. */
  @Roles(Role.ADMIN, Role.VIEWER)
  @Get('settings')
  getSettings() {
    return this.admin.getSettings();
  }

  @Put('settings')
  updateSettings(@Body() dto: UpdateQuizSettingsDto) {
    return this.admin.updateSettings(dto);
  }

  @Roles(Role.ADMIN, Role.VIEWER)
  @Get('upcoming')
  upcoming() {
    return this.admin.upcoming();
  }

  /**
   * Aggregate quiz analytics. Declared before `:id` so it is not read as a
   * quiz id.
   */
  @Roles(Role.ADMIN, Role.VIEWER)
  @Get('analytics')
  analytics(@Query('days') days?: string) {
    return this.admin.analytics(days);
  }

  /** Turns the automatic loop on — the admin "Start quiz" control. */
  @Post('start')
  start() {
    return this.admin.setLoopEnabled(true);
  }

  /**
   * Turns the automatic loop off. Sessions that already exist keep running to
   * completion so nobody who has paid loses their entry; no new ones are
   * prepared.
   */
  @Post('stop')
  stop() {
    return this.admin.setLoopEnabled(false);
  }

  @Roles(Role.ADMIN, Role.VIEWER)
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.admin.getQuiz(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.admin.cancelQuiz(id);
  }

  @Post(':id/settle')
  settle(@Param('id') id: string) {
    return this.admin.settleQuiz(id);
  }
}

/**
 * Question bank CRUD. Separate controller so the route prefix reads
 * `admin/quiz/questions` (singular "quiz"), matching the spec's suggested
 * paths while keeping the session routes plural.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/quiz/questions')
export class QuizQuestionsAdminController {
  constructor(private readonly admin: QuizAdminService) {}

  @Roles(Role.ADMIN, Role.VIEWER)
  @Get()
  list(
    @Query('category') category?: QuizCategory,
    @Query('active') active?: string,
    @Query('search') search?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.admin.listQuestions({ category, active, search, skip, take });
  }

  /** Per-category active/total counts for the admin overview. */
  @Roles(Role.ADMIN, Role.VIEWER)
  @Get('counts')
  counts() {
    return this.admin.questionCounts();
  }

  @Post()
  create(@Body() dto: CreateQuizQuestionDto) {
    return this.admin.createQuestion(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateQuizQuestionDto) {
    return this.admin.updateQuestion(id, dto);
  }

  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body() dto: SetQuestionStatusDto) {
    return this.admin.setQuestionStatus(id, dto.active);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.admin.deleteQuestion(id);
  }
}
