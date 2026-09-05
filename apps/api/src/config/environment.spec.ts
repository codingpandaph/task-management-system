import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateEnvironment } from './environment';

test('environment defaults allow startup without local configuration', () => {
  assert.deepEqual(validateEnvironment({}), { NODE_ENV: 'development', PORT: 3001 });
});

test('environment accepts and converts configured ports', () => {
  assert.deepEqual(validateEnvironment({ NODE_ENV: 'production', PORT: '4000' }), {
    NODE_ENV: 'production',
    PORT: 4000,
  });
});

test('environment rejects invalid ports and runtime modes before startup', () => {
  for (const PORT of ['', 'abc', '1.5', '0', '65536', false]) {
    assert.throws(() => validateEnvironment({ PORT }), /PORT must be/);
  }
  assert.throws(() => validateEnvironment({ NODE_ENV: 'invalid' }), /NODE_ENV must be/);
});
