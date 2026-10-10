import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { config } from './config.js';
import { sendData } from './lib/http.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createRateLimiter } from './middleware/rateLimit.js';
import { authRoutes } from './routes/auth.routes.js';
import { tripsRoutes } from './routes/trips.routes.js';

export type AppOptions = {
  /** Requests per minute per IP (api-contract-spec §8). Overridable for tests. */
  rateLimits?: { credentials: number; general: number };
};

export function createApp({ rateLimits = { credentials: 10, general: 100 } }: AppOptions = {}) {
  const app = express();
  // Requests arrive through Vercel and API Gateway. Trust exactly that many X-Forwarded-* hops,
  // so clients can't spoof their IP to dodge rate limits.
  app.set('trust proxy', config.TRUST_PROXY_HOPS);

  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    sendData(res, 200, { status: 'ok' });
  });

  app.use(createRateLimiter(rateLimits.general));
  app.use('/auth', authRoutes(createRateLimiter(rateLimits.credentials)));
  app.use('/trips', tripsRoutes());

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
