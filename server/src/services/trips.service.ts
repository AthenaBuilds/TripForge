import { z } from 'zod';
import type { createTripInputSchema, updateTripInputSchema } from '@tripforge/shared';
import { Prisma } from '../generated/prisma/client.js';
import { fromDbDate, toDbDate } from '../lib/dates.js';
import { prisma } from '../lib/db.js';
import { notFound } from '../lib/errors.js';
import {
  assertItemCapacity,
  assertItemInTrip,
  assertItemTimes,
  assertTripDates,
  planDateChange,
} from './rules.js';

type CreateTrip = z.output<typeof createTripInputSchema>;
type UpdateTrip = z.output<typeof updateTripInputSchema>;
type Db = Prisma.TransactionClient | typeof prisma;

/** Item order from api-contract-spec §2: date, then startTime (untimed first), then createdAt. */
export const itemOrder: Prisma.ItineraryItemOrderByWithRelationInput[] = [
  { date: 'asc' },
  { startTime: { sort: 'asc', nulls: 'first' } },
  { createdAt: 'asc' },
];

export function listTrips(userId: string) {
  return prisma.trip.findMany({
    where: { userId },
    orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
    include: { _count: { select: { items: true } } },
  });
}

/** The trip if the user owns it; otherwise 404, whether it's missing or someone else's. */
export async function findOwnedTrip(userId: string, tripId: string, db: Db = prisma) {
  const trip = await db.trip.findFirst({ where: { id: tripId, userId } });
  if (!trip) throw notFound('Trip not found');
  return trip;
}

export async function getTrip(userId: string, tripId: string, db: Db = prisma) {
  const trip = await db.trip.findFirst({
    where: { id: tripId, userId },
    include: { items: { orderBy: itemOrder } },
  });
  if (!trip) throw notFound('Trip not found');
  return trip;
}

export async function createTrip(userId: string, input: CreateTrip) {
  const range = { startDate: input.startDate, endDate: input.endDate };
  assertTripDates(range);
  assertItemCapacity(0, input.items.length);
  input.items.forEach((item, i) => {
    assertItemInTrip(item.date, range, `items[${i}]`);
    assertItemTimes(item, `items[${i}]`);
  });

  return prisma.$transaction(async (tx) => {
    const trip = await tx.trip.create({
      data: {
        userId,
        destination: input.destination,
        startDate: toDbDate(input.startDate),
        endDate: toDbDate(input.endDate),
      },
    });
    // One by one rather than createMany, so createdAt preserves the submitted order
    // for items that share a date and start time.
    for (const item of input.items) {
      await tx.itineraryItem.create({
        data: { ...item, tripId: trip.id, date: toDbDate(item.date) },
      });
    }
    return getTrip(userId, trip.id, tx);
  });
}

export async function updateTrip(userId: string, tripId: string, input: UpdateTrip) {
  return prisma.$transaction(async (tx) => {
    const trip = await findOwnedTrip(userId, tripId, tx);
    const current = { startDate: fromDbDate(trip.startDate), endDate: fromDbDate(trip.endDate) };
    const next = {
      startDate: input.startDate ?? current.startDate,
      endDate: input.endDate ?? current.endDate,
    };

    const datesChanged = next.startDate !== current.startDate || next.endDate !== current.endDate;
    if (datesChanged) {
      const items = await tx.itineraryItem.findMany({
        where: { tripId },
        select: { id: true, date: true },
      });
      const offset = planDateChange(
        current,
        next,
        items.map((item) => ({ id: item.id, date: fromDbDate(item.date) })),
        input.shiftItems,
      );
      if (offset !== 0) {
        await tx.$executeRaw`
          UPDATE itinerary_items
          SET date = date + ${offset}::int, updated_at = now()
          WHERE trip_id = ${tripId}::uuid`;
      }
    }

    await tx.trip.update({
      where: { id: tripId },
      data: {
        ...(input.destination !== undefined && { destination: input.destination }),
        startDate: toDbDate(next.startDate),
        endDate: toDbDate(next.endDate),
      },
    });
    return getTrip(userId, tripId, tx);
  });
}

export async function deleteTrip(userId: string, tripId: string) {
  const { count } = await prisma.trip.deleteMany({ where: { id: tripId, userId } });
  if (count === 0) throw notFound('Trip not found');
}
