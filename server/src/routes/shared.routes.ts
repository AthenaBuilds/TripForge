import { Router, type RequestHandler } from 'express';
import * as share from '../controllers/share.controller.js';

/** Keep shared trips out of search engines and caches, and don't leak the slug via Referer. */
const sharedHeaders: RequestHandler = (_req, res, next) => {
  res.set({
    'X-Robots-Tag': 'noindex, nofollow',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
  });
  next();
};

export function sharedRoutes(limiter: RequestHandler): Router {
  const router = Router();
  router.use(limiter, sharedHeaders);
  router.get('/:slug', share.getShared);
  router.get('/:slug/export', share.exportShared);
  return router;
}
