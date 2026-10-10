import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiFailure, ErrorDetail } from '@tripforge/shared';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';

function fieldPath(path: PropertyKey[]): string {
  // ['items', 3, 'title'] -> 'items[3].title' (api-contract-spec §6.3)
  return path.reduce<string>((acc, key) => {
    if (typeof key === 'number') return `${acc}[${key}]`;
    return acc ? `${acc}.${String(key)}` : String(key);
  }, '');
}

function zodDetails(error: ZodError): ErrorDetail[] {
  return error.issues.flatMap((issue) => {
    // Unknown fields from strict schemas: report each one as its own field.
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => ({
        field: fieldPath([...issue.path, key]),
        message: 'Unknown field',
      }));
    }
    return [{ field: fieldPath(issue.path) || '(root)', message: issue.message }];
  });
}

function send(res: Parameters<ErrorRequestHandler>[2], status: number, error: ApiFailure['error']) {
  const body: ApiFailure = { data: null, error };
  res.status(status).json(body);
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  send(res, 404, { code: 'NOT_FOUND', message: 'Not found' });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    return send(res, err.status, {
      code: err.code,
      message: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  if (err instanceof ZodError) {
    return send(res, 400, {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: zodDetails(err),
    });
  }

  // body-parser errors: malformed JSON, body over the 100 KB limit, etc.
  if (typeof err === 'object' && err !== null && 'type' in err && 'status' in err) {
    const status = Number(err.status);
    if (status >= 400 && status < 500) {
      const message =
        err.type === 'entity.too.large' ? 'Request body is too large' : 'Malformed request body';
      return send(res, 400, { code: 'VALIDATION_ERROR', message, details: [] });
    }
  }

  req.log.error({ err }, 'Unhandled error');
  send(res, 500, { code: 'INTERNAL_ERROR', message: 'Something went wrong' });
};
