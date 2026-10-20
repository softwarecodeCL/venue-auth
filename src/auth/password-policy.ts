import { BadRequestException } from '@nestjs/common';

/** bcrypt truncates at 72 UTF-8 bytes, not 72 characters. */
export function assertNewPassword(password: unknown): asserts password is string {
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new BadRequestException({ code: 'PASSWORD_LENGTH' });
  }
}
