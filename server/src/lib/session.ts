import type { CookieOptions, Response } from 'express';
import jwt from 'jsonwebtoken';
import { SESSION_COOKIE } from '@tripforge/shared';
import { config } from '../config.js';

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: 'lax',
  path: '/',
};

export function signSession(userId: string): string {
  return jwt.sign({}, config.JWT_SECRET, {
    algorithm: 'HS256',
    subject: userId,
    expiresIn: SESSION_TTL_SECONDS,
  });
}

/** Returns the user id, or null if the token is missing, expired, or invalid. */
export function verifySession(token: unknown): string | null {
  if (typeof token !== 'string' || token === '') return null;
  try {
    const payload = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] });
    return typeof payload === 'object' && typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, userId: string): void {
  res.cookie(SESSION_COOKIE, signSession(userId), {
    ...cookieOptions,
    maxAge: SESSION_TTL_SECONDS * 1000,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}
