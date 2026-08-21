import { IsString, IsNotEmpty } from 'class-validator';

export class ReplaceLuckyWinnerDto {
  @IsString()
  @IsNotEmpty()
  newUserId!: string;
}
