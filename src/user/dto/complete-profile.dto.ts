import { Role } from '@prisma/client';
import { Equals, IsIn, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class CompleteProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsIn([Role.GUEST, Role.HOST])
  mode: Role;

  @ValidateIf(dto => dto.mode === Role.HOST || dto.hostDeclarationAccepted !== undefined)
  @Equals(true)
  hostDeclarationAccepted?: boolean;
}
