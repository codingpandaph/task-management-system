import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import pino from 'pino';

const logger = pino({
  base: { service: 'cpsync-api' },
  redact: { paths: ['*.password', '*.token', '*.authorization', '*.cookie'], censor: '[redacted]' },
});

export function requestLogging(request: Request, response: Response, next: NextFunction) {
  const requestId = request.header('x-request-id')?.slice(0, 100) || randomUUID();
  const traceparent = request.header('traceparent');
  const traceId =
    traceparent?.match(/^00-([a-f0-9]{32})-[a-f0-9]{16}-[a-f0-9]{2}$/)?.[1] ?? randomUUID().replaceAll('-', '');
  const startedAt = performance.now();
  response.setHeader('x-request-id', requestId);
  response.setHeader('x-trace-id', traceId);
  response.on('finish', () => {
    logger.info(
      {
        requestId,
        traceId,
        method: request.method,
        path: request.path,
        status: response.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
      },
      'request completed',
    );
  });
  next();
}
