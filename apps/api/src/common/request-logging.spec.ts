import assert from 'node:assert/strict';
import test from 'node:test';
import { requestLogging } from './request-logging';

test('request logging exposes a request ID without reading sensitive headers', () => {
  let finished: (() => void) | undefined;
  const headers = new Map<string, string>();
  requestLogging(
    {
      header: (name: string) => (name === 'x-request-id' ? 'job-demo-request' : undefined),
      method: 'POST',
      path: '/api/auth/login',
    } as never,
    {
      statusCode: 200,
      setHeader: (name: string, value: string) => headers.set(name, value),
      on: (_event: string, callback: () => void) => {
        finished = callback;
      },
    } as never,
    () => undefined,
  );
  assert.equal(headers.get('x-request-id'), 'job-demo-request');
  assert.match(headers.get('x-trace-id') ?? '', /^[a-f0-9]{32}$/);
  assert.ok(finished);
});
