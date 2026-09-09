import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('CI generates the Prisma client before static analysis and compilation', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/verify.yml', import.meta.url), 'utf8');
  const generate = workflow.indexOf('yarn db:generate');

  assert.ok(generate > workflow.indexOf('yarn install --immutable'));
  for (const command of ['yarn lint', 'yarn typecheck', 'yarn test:unit', 'yarn build']) {
    assert.ok(generate < workflow.indexOf(command), `Prisma generation must run before ${command}`);
  }
});
