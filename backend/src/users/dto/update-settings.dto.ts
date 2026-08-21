import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  push?: boolean;

  @IsOptional()
  @IsBoolean()
  lucky?: boolean;

  @IsOptional()
  @IsBoolean()
  results?: boolean;

  @IsOptional()
  @IsBoolean()
  leaderboard?: boolean;
}
