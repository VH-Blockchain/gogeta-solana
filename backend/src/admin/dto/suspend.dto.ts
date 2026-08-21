import { IsBoolean } from 'class-validator';

export class SuspendDto {
  @IsBoolean()
  suspended!: boolean;
}
