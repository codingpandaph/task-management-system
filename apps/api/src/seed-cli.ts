import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DatabaseService } from './modules/database/database.module';
import { seed } from './seed';

void (async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    await seed(app.get(DatabaseService));
    console.log('Fictional seed ready. Credentials are documented in README.');
  } finally {
    await app.close();
  }
})().catch(() => {
  console.error('Seed failed; verify database and development opt-in.');
  process.exitCode = 1;
});
