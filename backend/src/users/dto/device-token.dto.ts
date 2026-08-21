import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class RegisterDeviceTokenDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsIn(['android', 'ios', 'web'])
  platform!: string;
}

export class UnregisterDeviceTokenDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}
