import { afterAll, beforeAll, vi } from 'vitest';
import { prisma } from '../lib/db.js';

// Tests are written as if today is 2026-10-10 (dates in Dec 2026 are "future").
// Only Date is faked, and it keeps ticking so timestamps still increase.
vi.useFakeTimers({
  toFake: ['Date'],
  shouldAdvanceTime: true,
  now: new Date('2026-10-10T09:00:00Z'),
});

// Each test file starts from an empty database.
beforeAll(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE users, trips, itinerary_items CASCADE');
});

afterAll(async () => {
  await prisma.$disconnect();
});
