import type { RequestHandler } from 'express';
import { SESSION_COOKIE } from '@tripforge/shared';
import { unauthenticated } from '../lib/errors.js';
import { verifySession } from '../lib/session.js';

export const requireAuth: RequestHandler = (req, _res, next) => {
  const userId = verifySession(req.cookies?.[SESSION_COOKIE]);
  if (!userId) return next(unauthenticated());
  req.user = { id: userId };
  next();
};

/** The authenticated user's id. Only call this in handlers mounted behind requireAuth. */
export function currentUserId(req: { user?: { id: string } }): string {
  if (!req.user) throw unauthenticated();
  return req.user.id;
}
