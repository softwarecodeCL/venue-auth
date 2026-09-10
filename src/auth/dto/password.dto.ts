import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail() @MaxLength(254) email: string;
  @IsOptional() @IsIn(['es', 'en']) locale?: 'es' | 'en';
}
export class ResetPasswordDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) token: string;
  @IsString() @MinLength(12) @MaxLength(72) password: string;
}
export class ChangePasswordDto {
  @IsString() @MinLength(1) @MaxLength(72) currentPassword: string;
  @IsString() @MinLength(12) @MaxLength(72) password: string;
}
