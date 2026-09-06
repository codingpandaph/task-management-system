import 'dotenv/config';
import { spawnSync } from 'node:child_process';

export function assertE2EDatabase(databaseUrl) {
  if (!databaseUrl || new URL(databaseUrl).pathname !== '/tms_test') {
    throw new Error('Refusing E2E reset: TEST_DATABASE_URL must point to the dedicated tms_test database.');
  }
  return databaseUrl;
}

function run(command, args, extraEnv = {}, cwd = process.cwd()) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const databaseUrl = assertE2EDatabase(process.env.TEST_DATABASE_URL);
  process.env.DATABASE_URL = databaseUrl;
  run('yarn', ['prisma', 'migrate', 'reset', '--force']);
  run('yarn', ['workspace', '@tms/api', 'build']);
  run(
    'node',
    ['dist/seed.js'],
    { NODE_ENV: 'test', ALLOW_DEMO_SEED: 'true', E2E_SEED: 'true' },
    new URL('../../apps/api/', import.meta.url),
  );
}
