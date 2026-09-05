import 'reflect-metadata';
import { ErrorsFilter } from './common/errors.filter';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { createValidationPipe } from './common/validation';
import type { Environment } from './config/environment';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Environment, true>);
  app.useGlobalFilters(new ErrorsFilter());
  app.use((_req: unknown, res: { setHeader: (name: string, value: string) => void }, next: () => void) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(cookieParser());
  app.use(helmet());
  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.useGlobalPipes(createValidationPipe());
  app.enableShutdownHooks();
  await app.listen(config.get('PORT', { infer: true }));
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
