import { ApiRequestError } from './client';

const FRIENDLY: Partial<Record<ApiRequestError['code'], string>> = {
  INVALID_CREDENTIALS: 'Email or password is incorrect.',
  EMAIL_TAKEN: 'An account with this email already exists. Try logging in.',
  RATE_LIMITED: 'Too many attempts. Please wait a minute and try again.',
  NOT_FOUND: 'We couldn’t find that. It may have been deleted.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again.',
};

/** A human-readable message for any error thrown by the API layer. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return FRIENDLY[error.code] ?? error.message;
  return 'Something went wrong. Please try again.';
}
