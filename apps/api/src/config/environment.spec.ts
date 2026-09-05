import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateEnvironment } from './environment';
const required = { DATABASE_URL: 'postgresql://localhost/tms_test', JWT_ACCESS_SECRET: 'x'.repeat(32) };
const validate = (values: Record<string, unknown>) => validateEnvironment({ ...required, ...values });

test('environment defaults allow startup without local configuration', () => {
  assert.equal(validate({}).PORT, 3001);
});

test('environment accepts and converts configured ports', () => {
  assert.equal(validate({ NODE_ENV: 'production', PORT: '4000', APP_ORIGIN: 'https://example.test' }).PORT, 4000);
});

test('environment rejects invalid ports and runtime modes before startup', () => {
  for (const PORT of ['', 'abc', '1.5', '0', '65536', false]) {
    assert.throws(() => validate({ PORT }), /PORT must be/);
  }
  assert.throws(() => validate({ NODE_ENV: 'invalid' }), /NODE_ENV must be/);
});
