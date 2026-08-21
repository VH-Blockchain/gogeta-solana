import {
  IsBoolean,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdatePredictionDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  subtitle?: string;

  @IsString()
  @IsOptional()
  info?: string;

  @IsString()
  @IsOptional()
  bannerImageUrl?: string;

  @IsBoolean()
  @IsOptional()
  featured?: boolean;

  @IsISO8601()
  @IsOptional()
  closesAt?: string;

  @IsISO8601()
  @IsOptional()
  opensAt?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  entryFee?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  reward?: number;

  /** Explicit true reverts this prediction to tracking Settings -> Points
   *  economy live; explicit false (with entryFee/reward) sets a fixed
   *  per-prediction override. Omit to leave the current mode untouched. */
  @IsBoolean()
  @IsOptional()
  useDefaultEconomy?: boolean;
}
