import { rateLimit, type Options } from 'express-rate-limit';
import type { ApiFailure } from '@tripforge/shared';

const body: ApiFailure = {
  data: null,
  error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again shortly' },
};

/** Per-IP limiter (api-contract-spec §8). Sends Retry-After and draft-7 RateLimit headers. */
export function createRateLimiter(limit: number, windowMs = 60_000) {
  const options: Partial<Options> = {
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res, _next, opts) => {
      res.status(opts.statusCode).json(body);
    },
  };
  return rateLimit(options);
}
