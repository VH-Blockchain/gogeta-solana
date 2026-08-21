import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { PredictionStatus, Role } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { BulkPredictionActionDto } from './dto/bulk-prediction-action.dto';
import { CreatePredictionDto } from './dto/create-prediction.dto';
import { UpdatePredictionDto } from './dto/update-prediction.dto';
import { ResolveDto } from './dto/resolve.dto';
import { ImportPolymarketDto } from './dto/import-polymarket.dto';

/** Parse an uploaded CSV buffer into row objects keyed by header column. */
function parseCsv(file?: Express.Multer.File): Record<string, string>[] {
  if (!file?.buffer) throw new BadRequestException('No CSV file uploaded (field name: file)');
  try {
    const rows = parse(file.buffer, {
      columns: (header: string[]) => header.map((h) => h.trim()),
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as Record<string, string>[];
    if (!rows.length) throw new Error('CSV has no data rows');
    return rows;
  } catch (e) {
    throw new BadRequestException(`Could not parse CSV: ${e instanceof Error ? e.message : 'invalid file'}`);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/predictions')
export class AdminPredictionsController {
  constructor(private readonly admin: AdminService) {}

  @Post()
  create(
    @CurrentUser('id') adminId: string,
    @Body() dto: CreatePredictionDto,
  ) {
    return this.admin.createPrediction(adminId, dto);
  }

  @Post('import')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  importPredictions(
    @CurrentUser('id') adminId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.admin.startImportPredictions(parseCsv(file), adminId);
  }

  /** Polled by the admin UI while an import started via POST import is
   *  still running, to show live "N/total processed" progress. */
  @Get('import/:jobId/status')
  importStatus(@Param('jobId') jobId: string) {
    return this.admin.getImportJobStatus(jobId);
  }

  @Post('import-resolutions')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  importResolutions(@UploadedFile() file: Express.Multer.File) {
    return this.admin.importResolutions(parseCsv(file));
  }

  @Post('import-polymarket')
  importPolymarket(@CurrentUser('id') adminId: string, @Query() dto: ImportPolymarketDto) {
    return this.admin.importPolymarketPredictions(adminId, dto, 'MANUAL');
  }

  /** One-time backfill for predictions imported before trendingScore existed
   *  — not a cron, call repeatedly (each call is one bounded batch) until
   *  the response's `remaining` is 0. See AdminService.backfillTrendingVolume
   *  doc comment for the full reasoning. */
  @Post('backfill-trending-volume')
  backfillTrendingVolume(@Query('take') take?: string) {
    return this.admin.backfillTrendingVolume(take ? Number(take) : undefined);
  }

  /** One-time backfill for predictions stuck in "Other" from before the
   *  multi-tag/synonym import fix — not a cron, call repeatedly passing
   *  back `nextCursor` until `remaining` is 0. See
   *  AdminService.backfillOtherCategories doc comment for the full
   *  reasoning. */
  @Post('backfill-other-categories')
  backfillOtherCategories(@Query('take') take?: string, @Query('cursor') cursor?: string) {
    return this.admin.backfillOtherCategories({ take: take ? Number(take) : undefined, cursor });
  }

  @Get('polymarket-logs')
  polymarketLogs(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.admin.listPolymarketImportLogs({ skip, take });
  }

  @Get('polymarket-resolution-logs')
  polymarketResolutionLogs(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.admin.listPolymarketResolutionLogs({ skip, take });
  }

  @Post(':id/check-resolution')
  checkResolution(@Param('id') id: string) {
    return this.admin.checkPolymarketResolution(id);
  }

  @Get(':id/resolution-checks')
  resolutionChecks(@Param('id') id: string, @Query('skip') skip?: string, @Query('take') take?: string) {
    return this.admin.listResolutionChecks(id, { skip, take });
  }

  @Post('bulk')
  bulk(@Body() dto: BulkPredictionActionDto) {
    return this.admin.bulkPredictionAction(dto.ids, dto.action);
  }

  @Post(':id/duplicate')
  duplicate(@CurrentUser('id') adminId: string, @Param('id') id: string) {
    return this.admin.duplicatePrediction(id, adminId);
  }

  @Get()
  @Roles(Role.ADMIN, Role.VIEWER)
  list(
    @Query('search') search?: string,
    @Query('status') status?: PredictionStatus,
    @Query('category') categoryKey?: string,
    @Query('closingHours') closingHours?: string,
    @Query('source') source?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.admin.listPredictions({ search, status, categoryKey, closingHours, source, skip, take });
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.VIEWER)
  getOne(@Param('id') id: string) {
    return this.admin.getPrediction(id);
  }

  @Get(':id/entries')
  @Roles(Role.ADMIN, Role.VIEWER)
  getEntries(@Param('id') id: string, @Query('skip') skip?: string, @Query('take') take?: string) {
    return this.admin.getPredictionEntries(id, { skip, take });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePredictionDto) {
    return this.admin.updatePrediction(id, dto);
  }

  @Post(':id/open')
  open(@Param('id') id: string) {
    return this.admin.setStatus(id, PredictionStatus.OPEN);
  }

  @Post(':id/close')
  close(@Param('id') id: string) {
    return this.admin.setStatus(id, PredictionStatus.LOCKED);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.admin.setStatus(id, PredictionStatus.CANCELLED);
  }

  @Post(':id/resolve')
  resolve(
    @CurrentUser('id') adminId: string,
    @Param('id') id: string,
    @Body() dto: ResolveDto,
  ) {
    return this.admin.resolvePrediction(id, dto, adminId);
  }
}
