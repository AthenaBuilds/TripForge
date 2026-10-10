import { randomBytes } from 'node:crypto';
import { prisma } from '../lib/db.js';
import { notFound } from '../lib/errors.js';
import { findOwnedTrip, itemOrder } from './trips.service.js';

/** 16 random bytes, base64url: 22 characters, 128 bits (backend-spec §7). */
function newSlug(): string {
  return randomBytes(16).toString('base64url');
}

/** Idempotent: returns the existing link if the trip is already shared. */
export async function shareTrip(userId: string, tripId: string) {
  const trip = await findOwnedTrip(userId, tripId);
  if (trip.shareSlug && trip.sharedAt) {
    return { shareSlug: trip.shareSlug, sharedAt: trip.sharedAt, created: false };
  }

  // Only set the slug if it's still unset, so two concurrent calls can't issue two links.
  const { count } = await prisma.trip.updateMany({
    where: { id: tripId, userId, shareSlug: null },
    data: { shareSlug: newSlug(), sharedAt: new Date() },
  });
  const shared = await findOwnedTrip(userId, tripId);
  return { shareSlug: shared.shareSlug!, sharedAt: shared.sharedAt!, created: count === 1 };
}

/** Revoking a trip that isn't shared is a no-op. A later share always gets a new slug. */
export async function unshareTrip(userId: string, tripId: string) {
  await findOwnedTrip(userId, tripId);
  await prisma.trip.updateMany({
    where: { id: tripId, userId },
    data: { shareSlug: null, sharedAt: null },
  });
}

export async function getSharedTrip(slug: string) {
  const trip = await prisma.trip.findUnique({
    where: { shareSlug: slug },
    include: { user: { select: { name: true } }, items: { orderBy: itemOrder } },
  });
  // Unknown and revoked slugs look the same.
  if (!trip) throw notFound('Shared trip not found');
  return trip;
}
