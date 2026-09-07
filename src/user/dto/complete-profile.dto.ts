import { Role } from '@prisma/client';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class CompleteProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsIn([Role.GUEST, Role.HOST])
  mode: Role;
}
