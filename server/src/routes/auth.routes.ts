import { Router, type RequestHandler } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

export function authRoutes(credentialsLimiter: RequestHandler): Router {
  const router = Router();
  router.post('/signup', credentialsLimiter, auth.signup);
  router.post('/login', credentialsLimiter, auth.login);
  router.post('/logout', auth.logout);
  router.get('/me', requireAuth, auth.me);
  return router;
}
