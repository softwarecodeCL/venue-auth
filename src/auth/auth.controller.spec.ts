import { Test } from '@nestjs/testing';
import { UserService } from '../user/user.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: {} },
        { provide: UserService, useValue: {} },
        { provide: PasswordService, useValue: {} },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  it('returns the authenticated request user from /auth/me', () => {
    const user = { id: 'user-1', roles: ['GUEST'] };
    const request = { user } as unknown as Parameters<AuthController['me']>[0];
    expect(controller.me(request)).toBe(user);
  });
});
