import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateEnvironment } from './environment';
const required = { DATABASE_URL: 'postgresql://localhost/tms_test', JWT_ACCESS_SECRET: 'x'.repeat(32) };
const validate = (values: Record<string, unknown>) => validateEnvironment({ ...required, ...values });

test('environment defaults allow startup without local configuration', () => {
  const environment = validate({});
  assert.equal(environment.PORT, 3001);
  assert.equal(environment.LOGIN_IDENTITY_LIMIT, 5);
  assert.equal(environment.LOGIN_IP_LIMIT, 20);
});

test('environment accepts and converts configured ports', () => {
  assert.equal(validate({ NODE_ENV: 'production', PORT: '4000', APP_ORIGIN: 'https://example.test' }).PORT, 4000);
});

test('environment rejects invalid ports and runtime modes before startup', () => {
  for (const PORT of ['', 'abc', '1.5', '0', '65536', false]) {
    assert.throws(() => validate({ PORT }), /PORT must be/);
  }
  assert.throws(() => validate({ NODE_ENV: 'invalid' }), /NODE_ENV must be/);
  assert.throws(() => validate({ LOGIN_IDENTITY_LIMIT: 0 }), /LOGIN_IDENTITY_LIMIT/);
  assert.throws(() => validate({ LOGIN_IP_LIMIT: 'nope' }), /LOGIN_IP_LIMIT/);
});
