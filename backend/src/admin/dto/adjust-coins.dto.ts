import { IsInt, IsOptional, IsString, NotEquals } from 'class-validator';

export class AdjustCoinsDto {
  @IsInt()
  @NotEquals(0)
  amount!: number;

  @IsString()
  @IsOptional()
  reason?: string;
}
