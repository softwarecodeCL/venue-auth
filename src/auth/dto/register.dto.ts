import { IsEmail, IsNotEmpty, MinLength, MaxLength, IsString, IsIn, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsOptional()
  @IsIn(['es', 'en'])
  locale?: 'es' | 'en';

  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsOptional()
  @IsString()
  @MinLength(12)
  @MaxLength(72)
  password?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(120)
  name: string;
}
