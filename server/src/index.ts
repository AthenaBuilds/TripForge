import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './lib/db.js';
import { logger } from './lib/logger.js';

const server = createApp().listen(config.PORT, () => {
  logger.info(`TripForge API listening on port ${config.PORT}`);
});

// ECS sends SIGTERM before stopping a task.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  });
}
