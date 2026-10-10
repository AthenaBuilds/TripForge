import type { ApiError, ApiResponse, ErrorDetail } from '@tripforge/shared';

const BASE = '/api';

/** A failed API call. `code` is the contract's error code, or NETWORK_ERROR / UNKNOWN_ERROR. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiError['code'] | 'NETWORK_ERROR' | 'UNKNOWN_ERROR',
    message: string,
    readonly details: ErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

let onUnauthenticated: (() => void) | null = null;

/** Registered by AuthProvider: a 401 on a session-backed call clears the session. */
export function setUnauthenticatedHandler(handler: (() => void) | null): void {
  onUnauthenticated = handler;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Public endpoints (/shared/*) and the session probe must not trigger the 401 handler. */
  skipAuthRedirect?: boolean;
};

async function send(path: string, { method = 'GET', body }: RequestOptions): Promise<Response> {
  try {
    return await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiRequestError(
      0,
      'NETWORK_ERROR',
      'Could not reach the server. Check your connection.',
    );
  }
}

async function toError(res: Response, options: RequestOptions): Promise<ApiRequestError> {
  if (res.status === 401 && !options.skipAuthRedirect) onUnauthenticated?.();

  const body = (await res.json().catch(() => null)) as ApiResponse<unknown> | null;
  if (body?.error) {
    return new ApiRequestError(res.status, body.error.code, body.error.message, body.error.details);
  }
  // e.g. API Gateway's own 429 or a proxy error page, without our envelope.
  if (res.status === 429) {
    return new ApiRequestError(429, 'RATE_LIMITED', 'Too many requests. Try again shortly.');
  }
  return new ApiRequestError(
    res.status,
    'UNKNOWN_ERROR',
    'Something went wrong. Please try again.',
  );
}

/** Calls a JSON endpoint and returns the envelope's `data` (or undefined for 204). */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await send(path, options);
  if (!res.ok) throw await toError(res, options);
  if (res.status === 204) return undefined as T;
  const body = (await res.json()) as ApiResponse<T>;
  return body.data as T;
}

/** Downloads a file endpoint as a Blob, with the filename from Content-Disposition. */
export async function apiDownload(
  path: string,
  options: RequestOptions = {},
): Promise<{ blob: Blob; filename: string }> {
  const res = await send(path, options);
  if (!res.ok) throw await toError(res, options);
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? 'tripforge-export';
  return { blob: await res.blob(), filename };
}
