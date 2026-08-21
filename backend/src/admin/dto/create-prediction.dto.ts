import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { PredictionStatus } from '@prisma/client';

export class PredictionOptionDto {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsNumber()
  @Min(0)
  odds!: number;
}

export class CreatePredictionDto {
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  subtitle?: string;

  @IsString()
  @IsOptional()
  info?: string;

  @IsString()
  @IsOptional()
  bannerImageUrl?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  entryFee?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  reward?: number;

  /** True (or entryFee/reward simply omitted) = track Settings -> Points
   *  economy live; false = use the entryFee/reward above as a fixed override. */
  @IsBoolean()
  @IsOptional()
  useDefaultEconomy?: boolean;

  @IsISO8601()
  closesAt!: string;

  /** Future date schedules the prediction to open automatically. */
  @IsISO8601()
  @IsOptional()
  opensAt?: string;

  @IsBoolean()
  @IsOptional()
  featured?: boolean;

  @IsEnum(PredictionStatus)
  @IsOptional()
  status?: PredictionStatus;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => PredictionOptionDto)
  options!: PredictionOptionDto[];
}
