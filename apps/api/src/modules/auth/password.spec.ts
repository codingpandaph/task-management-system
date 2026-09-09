import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePassword } from './auth.service';

test('password guidance uses plain language', () => {
  assert.throws(() => validatePassword('too short'), /Use at least 15 characters/);
  assert.throws(() => validatePassword('🙂'.repeat(19)), /This password is too long\. Choose a shorter password/);
  assert.doesNotThrow(() => validatePassword('A long memorable password'));
});
