import { IsNotEmpty, IsString } from 'class-validator';

export class SubmitPredictionDto {
  @IsString()
  @IsNotEmpty()
  optionId!: string;
}
