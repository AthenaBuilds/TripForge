import { ERROR_CODES, type ErrorCode, type ErrorDetail } from '@tripforge/shared';

/** A domain error that maps directly to an API error response. */
export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'AppError';
    this.status = ERROR_CODES[code];
  }
}

export const notFound = (message = 'Not found') => new AppError('NOT_FOUND', message);
export const unauthenticated = () => new AppError('UNAUTHENTICATED', 'Authentication required');
