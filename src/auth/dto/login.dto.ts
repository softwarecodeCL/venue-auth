import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(256)
  password: string;
}
