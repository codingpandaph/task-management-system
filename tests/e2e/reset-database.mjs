import 'dotenv/config';
import { spawnSync } from 'node:child_process';

export function assertE2EDatabase(databaseUrl) {
  if (!databaseUrl || new URL(databaseUrl).pathname !== '/tms_test') {
    throw new Error('Refusing E2E reset: TEST_DATABASE_URL must point to the dedicated tms_test database.');
  }
  return databaseUrl;
}

export function seedProfile(environment = process.env) {
  return environment.SEED_PROFILE === 'integration' ? 'full' : 'limited';
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
  const profile = seedProfile();
  const repositoryRoot = new URL('../../', import.meta.url);
  process.env.DATABASE_URL = databaseUrl;
  run('yarn', ['prisma', 'migrate', 'reset', '--force'], {}, repositoryRoot);
  run('yarn', ['workspace', '@tms/api', 'build'], {}, repositoryRoot);
  run(
    'node',
    ['dist/seed-cli.js'],
    { NODE_ENV: 'test', ALLOW_DEMO_SEED: 'true', E2E_SEED: String(profile === 'limited') },
    new URL('../../apps/api/', import.meta.url),
  );
}
