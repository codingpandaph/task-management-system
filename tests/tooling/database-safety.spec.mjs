import assert from 'node:assert/strict';
import test from 'node:test';
import { approvedPrototypeDatabase } from '../../scripts/database-safety.mjs';

test('backup tooling accepts only the named local prototype database', () => {
  assert.equal(approvedPrototypeDatabase('postgresql://localhost:5432/tms_development', 'tms_development'), true);
  assert.equal(approvedPrototypeDatabase('postgresql://db.example.com:5432/tms_development', 'tms_development'), false);
  assert.equal(approvedPrototypeDatabase('postgresql://localhost:5432/tms_production', 'tms_production'), false);
  assert.equal(approvedPrototypeDatabase('postgresql://localhost:5432/another', 'tms_development'), false);
});
