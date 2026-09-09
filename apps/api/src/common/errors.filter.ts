import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import pino from 'pino';
import { Prisma } from '../generated/prisma/client';
const logger = pino({ redact: ['password', 'passwordHash', 'token', 'cookies', 'authorization'] });
@Catch()
export class ErrorsFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const requestId = response.getHeader('x-request-id')?.toString() ?? request.header('x-request-id') ?? randomUUID();
    let status = 500,
      message = 'An unexpected error occurred',
      code = 'INTERNAL_ERROR';
    if (error instanceof HttpException) {
      status = error.getStatus();
      const body = error.getResponse();
      message =
        typeof body === 'string'
          ? body
          : typeof body === 'object' && body && 'message' in body
            ? String(body.message)
            : error.message;
      code =
        status === 409
          ? 'CONFLICT'
          : status === 403
            ? 'FORBIDDEN'
            : status === 401
              ? 'UNAUTHENTICATED'
              : status === 422
                ? 'BUSINESS_RULE'
                : 'REQUEST_ERROR';
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      status = error.code === 'P2025' ? 404 : 409;
      message = status === 404 ? 'Resource not found' : 'The operation conflicts with existing data';
      code = status === 404 ? 'NOT_FOUND' : 'CONFLICT';
    }
    logger[status >= 500 ? 'error' : 'info']({ requestId, status, code }, 'request failed');
    response.status(status).setHeader('Cache-Control', 'no-store');
    response.json({ requestId, code, message });
  }
}
