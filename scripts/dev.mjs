import 'dotenv/config';
import { spawnSync } from 'node:child_process';

export function databaseMode(environment = process.env) {
  return environment.FRESH_DB === 'true' ? 'fresh' : 'retain';
}

export function assertDevelopmentDatabase(databaseUrl) {
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  const url = new URL(databaseUrl);
  const database = url.pathname.slice(1);
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || !database || database === 'tms_test') {
    throw new Error('Fresh development startup requires a local development database and refuses tms_test.');
  }
  return database;
}

function run(command, args, extraEnvironment = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...extraEnvironment },
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const mode = databaseMode();
  if (mode === 'fresh') {
    const database = assertDevelopmentDatabase(process.env.DATABASE_URL);
    console.log(`Fresh mode: resetting local development database "${database}".`);
    run('yarn', ['prisma', 'migrate', 'reset', '--force']);
    run('yarn', ['db:seed'], { NODE_ENV: 'development', ALLOW_DEMO_SEED: 'true' });
  } else {
    console.log('Retain mode: preserving the current development database.');
  }
  run('yarn', ['dev:services']);
}
