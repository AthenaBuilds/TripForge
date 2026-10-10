import { z } from 'zod';
import type {
  itineraryItemInputSchema,
  itineraryItemPatchSchema,
  replaceItemsInputSchema,
} from '@tripforge/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { fromDbDate, toDbDate } from '../lib/dates.js';
import { prisma } from '../lib/db.js';
import { notFound } from '../lib/errors.js';
import { assertItemCapacity, assertItemInTrip, assertItemTimes } from './rules.js';
import { findOwnedTrip, getTrip } from './trips.service.js';

type ItemInput = z.output<typeof itineraryItemInputSchema>;
type ItemPatch = z.output<typeof itineraryItemPatchSchema>;
type ReplaceItems = z.output<typeof replaceItemsInputSchema>;

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
 * Replace the whole itinerary in one transaction (PUT /trips/:tripId/items, "Update Trip").
 * Listed items with an id are updated, items without one are created, the rest are deleted.
 * Every rule is checked on the final list before anything is written.
 */
export async function replaceItems(userId: string, tripId: string, input: ReplaceItems) {
  return prisma.$transaction(async (tx) => {
    const trip = await findOwnedTrip(userId, tripId, tx);
    const range = tripRange(trip);

    assertItemCapacity(0, input.items.length);
    input.items.forEach((item, i) => {
      assertItemInTrip(item.date, range, `items[${i}]`);
      assertItemTimes(item, `items[${i}]`);
    });

    const existing = await tx.itineraryItem.findMany({ where: { tripId }, select: { id: true } });
    const existingIds = new Set(existing.map((i) => i.id));
    const keptIds = input.items.flatMap((i) => (i.id ? [i.id] : []));
    if (keptIds.some((id) => !existingIds.has(id))) throw notFound('Item not found');

    await tx.itineraryItem.deleteMany({ where: { tripId, id: { notIn: keptIds } } });
    for (const { id, ...item } of input.items) {
      // Full replacement: omitted optional fields are cleared.
      const data = {
        title: item.title,
        date: toDbDate(item.date),
        startTime: item.startTime ?? null,
        endTime: item.endTime ?? null,
        city: item.city ?? null,
        location: item.location ?? null,
        notes: item.notes ?? null,
      };
      if (id) await tx.itineraryItem.update({ where: { id }, data });
      else await tx.itineraryItem.create({ data: { ...data, tripId } });
    }
    await touchTrip(tx, tripId);
    return getTrip(userId, tripId, tx);
  });
}

/**
 * Bump the trip's updatedAt when its itinerary changes; the shared view shows it as
 * "last updated".
 */
function touchTrip(tx: Prisma.TransactionClient, tripId: string) {
  return tx.trip.update({ where: { id: tripId }, data: { updatedAt: new Date() } });
}
