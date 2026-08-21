import { IsNotEmpty, IsString } from 'class-validator';

export class ResolveDto {
  @IsString()
  @IsNotEmpty()
  correctOptionId!: string;
}
