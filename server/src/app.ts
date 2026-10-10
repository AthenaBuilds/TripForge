import express from 'express';

export function createApp() {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  return app;
}
