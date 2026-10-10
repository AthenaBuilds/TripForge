// Response envelope and error codes (api-contract-spec.md §4–5).

export const ERROR_CODES = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  NOT_FOUND: 404,
  EMAIL_TAKEN: 409,
  DATE_RANGE_INVALID: 422,
  START_DATE_IN_PAST: 422,
  ITEM_DATE_OUT_OF_RANGE: 422,
  ITEM_TIME_INVALID: 422,
  ITEMS_OUT_OF_RANGE: 422,
  ITEM_LIMIT_REACHED: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export type ErrorDetail = { field: string; message: string; [k: string]: unknown };

export type ApiError = {
  code: ErrorCode;
  message: string;
  details?: ErrorDetail[];
};

export type ApiSuccess<T> = { data: T; error: null };
export type ApiFailure = { data: null; error: ApiError };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export const SESSION_COOKIE = 'tf_session';
