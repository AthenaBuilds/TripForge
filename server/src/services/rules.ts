// Domain rules from backend-spec §6. Pure functions so they can be unit-tested without a database.
import { LIMITS, addDays, daysBetween, isDateInRange, tripLengthDays } from '@tripforge/shared';
import { AppError } from '../lib/errors.js';

type DateRange = { startDate: string; endDate: string };
type ItemTimes = { startTime?: string | null; endTime?: string | null };

export function assertTripDates({ startDate, endDate }: DateRange): void {
  if (startDate > endDate) {
    throw new AppError('DATE_RANGE_INVALID', 'endDate must be on or after startDate');
  }
  if (tripLengthDays(startDate, endDate) > LIMITS.tripMaxDays) {
    throw new AppError('DATE_RANGE_INVALID', `A trip can last at most ${LIMITS.tripMaxDays} days`);
  }
}

/**
 * A trip can't start in the past (goal-spec §10, 2026-10-10). The server doesn't know the user's
 * time zone, so "past" means before yesterday in UTC; the frontend enforces the local today.
 */
export function assertStartNotPast(startDate: string, now = new Date()): void {
  const earliest = addDays(now.toISOString().slice(0, 10), -1);
  if (startDate < earliest) {
    throw new AppError('START_DATE_IN_PAST', "The trip can't start in the past");
  }
}

/** `label` names the item in the message, e.g. "items[3]" when creating a trip. */
export function assertItemTimes({ startTime, endTime }: ItemTimes, label = 'Item'): void {
  // HH:mm strings compare correctly as strings.
  if (startTime && endTime && startTime > endTime) {
    throw new AppError('ITEM_TIME_INVALID', `${label}: startTime must be at or before endTime`);
  }
}

export function assertItemInTrip(date: string, trip: DateRange, label = 'Item'): void {
  if (!isDateInRange(date, trip.startDate, trip.endDate)) {
    throw new AppError(
      'ITEM_DATE_OUT_OF_RANGE',
      `${label}: date must be between ${trip.startDate} and ${trip.endDate}`,
    );
  }
}

export function assertItemCapacity(existing: number, adding: number): void {
  if (existing + adding > LIMITS.itemsPerTripMax) {
    throw new AppError(
      'ITEM_LIMIT_REACHED',
      `A trip can have at most ${LIMITS.itemsPerTripMax} items`,
    );
  }
}

/**
 * Plans a trip date change (api-contract-spec PATCH /trips/:tripId).
 * Returns the day offset to apply to every item (0 unless shiftItems moves the start date),
 * or throws ITEMS_OUT_OF_RANGE listing the items that would fall outside the new range.
 */
export function planDateChange(
  current: DateRange,
  next: DateRange,
  items: Array<{ id: string; date: string }>,
  shiftItems: boolean,
): number {
  assertTripDates(next);
  const offset = shiftItems ? daysBetween(current.startDate, next.startDate) : 0;

  const outside = items
    .filter((item) => !isDateInRange(addDays(item.date, offset), next.startDate, next.endDate))
    .map((item) => item.id);

  if (outside.length > 0) {
    const noun = outside.length === 1 ? 'item falls' : 'items fall';
    throw new AppError('ITEMS_OUT_OF_RANGE', 'Some items fall outside the new trip dates', [
      {
        field: 'items',
        message: `${outside.length} ${noun} outside the new dates`,
        itemIds: outside,
      },
    ]);
  }
  return offset;
}
