import assert from 'node:assert/strict';
import test from 'node:test';
import { formatEstimation, parseEstimationInput } from './estimation';

test('formats stored hours as work days and hours', () => {
  assert.equal(formatEstimation(12), '1d 4h');
  assert.equal(formatEstimation(8), '1d');
  assert.equal(formatEstimation(0), '0h');
});

test('parses day and hour estimation input', () => {
  assert.equal(parseEstimationInput('1d 4h'), 12);
  assert.equal(parseEstimationInput('2h'), 2);
  assert.throws(() => parseEstimationInput('tomorrow'));
});
