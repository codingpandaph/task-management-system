import 'reflect-metadata';
import { ErrorsFilter } from './common/errors.filter';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { RequestMethod } from '@nestjs/common';

import { AppModule } from './app.module';
import { createValidationPipe } from './common/validation';
import type { Environment } from './config/environment';
import { requestLogging } from './common/request-logging';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Environment, true>);
  app.useGlobalFilters(new ErrorsFilter());
  app.use(requestLogging);
  app.use((_req: unknown, res: { setHeader: (name: string, value: string) => void }, next: () => void) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(cookieParser());
  app.use(helmet());
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.ALL },
      { path: 'health/{*splat}', method: RequestMethod.ALL },
    ],
  });
  app.useGlobalPipes(createValidationPipe());
  app.enableShutdownHooks();
  await app.listen(config.get('PORT', { infer: true }));
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
