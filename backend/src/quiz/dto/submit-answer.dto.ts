import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class SubmitAnswerDto {
  @IsString()
  @IsNotEmpty()
  questionId!: string;

  /** 0-based index into the four options as they were served. */
  @IsInt()
  @Min(0)
  @Max(3)
  selectedIndex!: number;
}
