import { ProfileMode } from '@prisma/client';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class CompleteProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsEnum(ProfileMode)
  mode: ProfileMode;
}
