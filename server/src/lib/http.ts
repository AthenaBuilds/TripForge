import type { Response } from 'express';
import type { ApiSuccess } from '@tripforge/shared';
import type { z } from 'zod';

/** Send a success envelope. */
export function sendData<T>(res: Response, status: number, data: T): void {
  const body: ApiSuccess<T> = { data, error: null };
  res.status(status).json(body);
}

/** Parse input with a Zod schema. A ZodError is turned into 400 VALIDATION_ERROR by errorHandler. */
export function parse<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  return schema.parse(value);
}
