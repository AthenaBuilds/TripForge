import { z } from 'zod';
import type { itineraryItemInputSchema, itineraryItemPatchSchema } from '@tripforge/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { fromDbDate, toDbDate } from '../lib/dates.js';
import { prisma } from '../lib/db.js';
import { notFound } from '../lib/errors.js';
import { assertItemCapacity, assertItemInTrip, assertItemTimes } from './rules.js';
import { findOwnedTrip } from './trips.service.js';

type ItemInput = z.output<typeof itineraryItemInputSchema>;
type ItemPatch = z.output<typeof itineraryItemPatchSchema>;

function tripRange(trip: { startDate: Date; endDate: Date }) {
  return { startDate: fromDbDate(trip.startDate), endDate: fromDbDate(trip.endDate) };
}

export async function addItem(userId: string, tripId: string, input: ItemInput) {
  return prisma.$transaction(async (tx) => {
    const trip = await findOwnedTrip(userId, tripId, tx);
    assertItemInTrip(input.date, tripRange(trip));
    assertItemTimes(input);
    assertItemCapacity(await tx.itineraryItem.count({ where: { tripId } }), 1);

    const item = await tx.itineraryItem.create({
      data: { ...input, tripId, date: toDbDate(input.date) },
    });
    await touchTrip(tx, tripId);
    return item;
  });
}

export async function updateItem(userId: string, tripId: string, itemId: string, patch: ItemPatch) {
  return prisma.$transaction(async (tx) => {
    const trip = await findOwnedTrip(userId, tripId, tx);
    const item = await tx.itineraryItem.findFirst({ where: { id: itemId, tripId } });
    if (!item) throw notFound('Item not found');

    // Rules apply to the stored values merged with the patch.
    const merged = {
      date: patch.date ?? fromDbDate(item.date),
      startTime: patch.startTime !== undefined ? patch.startTime : item.startTime,
      endTime: patch.endTime !== undefined ? patch.endTime : item.endTime,
    };
    assertItemInTrip(merged.date, tripRange(trip));
    assertItemTimes(merged);

    const updated = await tx.itineraryItem.update({
      where: { id: itemId },
      data: { ...patch, ...(patch.date !== undefined && { date: toDbDate(patch.date) }) },
    });
    await touchTrip(tx, tripId);
    return updated;
  });
}

export async function deleteItem(userId: string, tripId: string, itemId: string) {
  await prisma.$transaction(async (tx) => {
    await findOwnedTrip(userId, tripId, tx);
    const { count } = await tx.itineraryItem.deleteMany({ where: { id: itemId, tripId } });
    if (count === 0) throw notFound('Item not found');
    await touchTrip(tx, tripId);
  });
}

/**
 * Bump the trip's updatedAt when its itinerary changes; the shared view shows it as
 * "last updated".
 */
function touchTrip(tx: Prisma.TransactionClient, tripId: string) {
  return tx.trip.update({ where: { id: tripId }, data: { updatedAt: new Date() } });
}
