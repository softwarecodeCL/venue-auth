import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  ValidationPipe,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { validateAuthEnvironment } from './config/env.validation';
import { browserMutationGuard, parseBrowserOrigins } from './config/browser-security';

const environment = validateAuthEnvironment(process.env);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  if (environment.AUTH_TRUST_PROXY) {
    app.getHttpAdapter().getInstance().set('trust proxy', environment.AUTH_TRUST_PROXY);
  }

  app.use(helmet());
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
  );

  const origins = parseBrowserOrigins(environment.CORS_ORIGINS, environment.NODE_ENV === 'production');
  app.use(browserMutationGuard(origins));

  app.enableCors({
    origin: origins,
    credentials: true,
    exposedHeaders: ['Retry-After'],
  });

  await app.listen(environment.PORT);
}

void bootstrap();
