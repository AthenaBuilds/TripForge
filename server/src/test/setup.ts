import { afterAll, beforeAll } from 'vitest';
import { prisma } from '../lib/db.js';

// Each test file starts from an empty database.
beforeAll(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE users, trips, itinerary_items CASCADE');
});

afterAll(async () => {
  await prisma.$disconnect();
});
