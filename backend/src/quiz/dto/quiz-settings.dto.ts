import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Partial update of the `quiz.*` settings. Every field is optional so the admin
 * UI can save one control at a time, matching how the existing Settings tabs
 * PUT a single key.
 *
 * Note there is no `durationSeconds`: it is derived from
 * questionsPerQuiz x secondsPerQuestion (see QuizConfigService) precisely so an
 * admin cannot save a trio of values that contradict each other.
 */
export class UpdateQuizSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(86_400)
  cycleSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(120)
  secondsPerQuestion?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  questionsPerQuiz?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  entryPoints?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  rewardPoints?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  winPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  answerGraceMs?: number;
}
