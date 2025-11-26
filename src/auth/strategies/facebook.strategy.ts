/*import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-facebook';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor() {
    super({
      clientID: process.env.FACEBOOK_CLIENT_ID as string,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET as string,
      callbackURL: 'http://localhost:3010/auth/facebook/callback',
      profileFields: ['emails', 'name', 'picture.type(large)'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any, done: Function) {
    const { name, emails, photos } = profile;
    const user = {
      email: emails?.[0]?.value,
      name: `${name.givenName} ${name.familyName}`,
      avatar: photos?.[0]?.value,
      provider: 'facebook',
    };
    done(null, user);
  }
}
*/