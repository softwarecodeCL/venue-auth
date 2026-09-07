import { IsString, Length } from 'class-validator';

export class SendPhoneCodeDto {
  @IsString()
  @Length(8, 30)
  phone!: string;
}
