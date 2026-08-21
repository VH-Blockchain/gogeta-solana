import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { QuizCategory } from '@prisma/client';

export class CreateQuizQuestionDto {
  @IsEnum(QuizCategory)
  category!: QuizCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  question!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  optionA!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  optionB!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  optionC!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  optionD!: string;

  /** 0-based index of the correct option. */
  @IsInt()
  @Min(0)
  @Max(3)
  correctIndex!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  explanation?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateQuizQuestionDto {
  @IsOptional()
  @IsEnum(QuizCategory)
  category?: QuizCategory;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  question?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  optionA?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  optionB?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  optionC?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  optionD?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  correctIndex?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  explanation?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class SetQuestionStatusDto {
  @IsBoolean()
  active!: boolean;
}
