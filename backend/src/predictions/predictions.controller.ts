import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PredictionStatus } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SubmitPredictionDto } from './dto/submit-prediction.dto';
import { PredictionsService } from './predictions.service';

@ApiTags('predictions')
@Controller('predictions')
export class PredictionsController {
  constructor(private readonly predictions: PredictionsService) {}

  @Get()
  list(
    @CurrentUser('id') userId: string,
    @CurrentUser('email') email: string,
    @Query('status') status?: PredictionStatus,
    @Query('category') category?: string,
    @Query('featured') featured?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
    @Query('closingHours') closingHours?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.predictions.list(userId, email, {
      status,
      category,
      featured,
      search,
      sort,
      closingHours,
      skip,
      take,
    });
  }

  @Get('mine/active')
  mineActive(@CurrentUser('id') userId: string, @CurrentUser('email') email: string) {
    return this.predictions.mineActive(userId, email);
  }

  @Get('mine/history')
  mineHistory(@CurrentUser('id') userId: string, @CurrentUser('email') email: string) {
    return this.predictions.mineHistory(userId, email);
  }

  @Get(':id')
  getOne(
    @CurrentUser('id') userId: string,
    @CurrentUser('email') email: string,
    @Param('id') id: string,
  ) {
    return this.predictions.getOne(userId, email, id);
  }

  @Post(':id/submit')
  submit(
    @CurrentUser('id') userId: string,
    @CurrentUser('email') email: string,
    @Param('id') id: string,
    @Body() dto: SubmitPredictionDto,
  ) {
    return this.predictions.submit(userId, id, dto, email);
  }
}
