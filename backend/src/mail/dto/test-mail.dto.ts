import { IsEmail } from 'class-validator';

export class TestMailDto {
  @IsEmail()
  to!: string;
}
