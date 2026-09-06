import assert from 'node:assert/strict';
import test from 'node:test';
import { assertDevelopmentDatabase, databaseMode } from '../../scripts/dev.mjs';
import { assertE2EDatabase } from '../e2e/reset-database.mjs';

test('development retains data unless fresh mode is explicitly enabled', () => {
  assert.equal(databaseMode({}), 'retain');
  assert.equal(databaseMode({ FRESH_DB: 'false' }), 'retain');
  assert.equal(databaseMode({ FRESH_DB: 'true' }), 'fresh');
});

test('E2E reset only accepts the dedicated tms_test database', () => {
  const testDatabase = 'postgresql://localhost:5432/tms_test';
  assert.equal(assertE2EDatabase(testDatabase), testDatabase);
  assert.throws(() => assertE2EDatabase('postgresql://localhost:5432/tms_development'), /dedicated tms_test/);
});

test('fresh mode accepts a local development database and rejects unsafe targets', () => {
  assert.equal(assertDevelopmentDatabase('postgresql://localhost:5432/tms'), 'tms');
  assert.throws(() => assertDevelopmentDatabase('postgresql://localhost:5432/tms_test'), /refuses tms_test/);
  assert.throws(() => assertDevelopmentDatabase('postgresql://db.example.com/tms'), /local development database/);
  assert.throws(() => assertDevelopmentDatabase(undefined), /DATABASE_URL/);
});
