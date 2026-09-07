import { IsUUID, Matches } from 'class-validator';

export class ConfirmPhoneCodeDto {
  @IsUUID()
  challengeId!: string;

  @Matches(/^\d{6}$/, { message: 'El código debe contener 6 dígitos' })
  code!: string;
}
