import { describe, expect, it } from 'vitest';
import { AppError } from '../lib/errors.js';
import {
  assertItemCapacity,
  assertItemInTrip,
  assertItemTimes,
  assertStartNotPast,
  assertTripDates,
  planDateChange,
} from './rules.js';

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (err) {
    if (err instanceof AppError) return err.code;
    throw err;
  }
  return undefined;
}

describe('assertTripDates', () => {
  it('accepts single-day and 60-day trips', () => {
    expect(codeOf(() => assertTripDates({ startDate: '2026-12-20', endDate: '2026-12-20' }))).toBe(
      undefined,
    );
    expect(codeOf(() => assertTripDates({ startDate: '2026-12-01', endDate: '2027-01-29' }))).toBe(
      undefined,
    );
  });

  it('rejects reversed ranges and trips over 60 days', () => {
    expect(codeOf(() => assertTripDates({ startDate: '2026-12-21', endDate: '2026-12-20' }))).toBe(
      'DATE_RANGE_INVALID',
    );
    expect(codeOf(() => assertTripDates({ startDate: '2026-12-01', endDate: '2027-01-30' }))).toBe(
      'DATE_RANGE_INVALID',
    );
  });
});

describe('assertItemTimes', () => {
  it('allows missing times, one time, or equal times', () => {
    expect(codeOf(() => assertItemTimes({}))).toBe(undefined);
    expect(codeOf(() => assertItemTimes({ startTime: '18:00', endTime: null }))).toBe(undefined);
    expect(codeOf(() => assertItemTimes({ startTime: '09:00', endTime: '09:00' }))).toBe(undefined);
  });

  it('rejects start after end', () => {
    expect(codeOf(() => assertItemTimes({ startTime: '18:00', endTime: '09:00' }))).toBe(
      'ITEM_TIME_INVALID',
    );
  });
});

describe('assertItemInTrip', () => {
  const trip = { startDate: '2026-12-20', endDate: '2026-12-24' };
  it('is inclusive at both ends', () => {
    expect(codeOf(() => assertItemInTrip('2026-12-20', trip))).toBe(undefined);
    expect(codeOf(() => assertItemInTrip('2026-12-24', trip))).toBe(undefined);
    expect(codeOf(() => assertItemInTrip('2026-12-25', trip))).toBe('ITEM_DATE_OUT_OF_RANGE');
  });
});

describe('assertItemCapacity', () => {
  it('allows up to 200 items', () => {
    expect(codeOf(() => assertItemCapacity(199, 1))).toBe(undefined);
    expect(codeOf(() => assertItemCapacity(200, 1))).toBe('ITEM_LIMIT_REACHED');
    expect(codeOf(() => assertItemCapacity(0, 201))).toBe('ITEM_LIMIT_REACHED');
  });
});

describe('planDateChange', () => {
  const current = { startDate: '2026-12-20', endDate: '2026-12-24' };
  const items = [
    { id: 'a', date: '2026-12-20' },
    { id: 'b', date: '2026-12-24' },
  ];

  it('returns 0 when items still fit without shifting', () => {
    expect(
      planDateChange(current, { startDate: '2026-12-19', endDate: '2026-12-25' }, items, false),
    ).toBe(0);
  });

  it('rejects with the ids of items left outside, without shifting', () => {
    try {
      planDateChange(current, { startDate: '2026-12-21', endDate: '2026-12-24' }, items, false);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const e = err as AppError;
      expect(e.code).toBe('ITEMS_OUT_OF_RANGE');
      expect(e.details).toEqual([
        { field: 'items', message: '1 item falls outside the new dates', itemIds: ['a'] },
      ]);
    }
  });

  it('shifts by the start-date offset across a year boundary (Dec 20–24 → Jan 10–14 = 21 days)', () => {
    expect(
      planDateChange(current, { startDate: '2027-01-10', endDate: '2027-01-14' }, items, true),
    ).toBe(21);
  });

  it('checks the range on shifted dates when the new range is also shorter', () => {
    expect(() =>
      planDateChange(current, { startDate: '2027-01-10', endDate: '2027-01-12' }, items, true),
    ).toThrow(expect.objectContaining({ code: 'ITEMS_OUT_OF_RANGE' }));
  });

  it('is a no-op shift when the start date is unchanged', () => {
    expect(
      planDateChange(current, { startDate: '2026-12-20', endDate: '2026-12-26' }, items, true),
    ).toBe(0);
  });

  it('validates the new range itself first', () => {
    expect(() =>
      planDateChange(current, { startDate: '2026-12-25', endDate: '2026-12-24' }, [], false),
    ).toThrow(expect.objectContaining({ code: 'DATE_RANGE_INVALID' }));
  });
});

describe('assertStartNotPast', () => {
  const now = new Date('2026-10-10T03:00:00Z');
  it('allows today and yesterday (UTC), for users in earlier time zones', () => {
    expect(codeOf(() => assertStartNotPast('2026-10-10', now))).toBe(undefined);
    expect(codeOf(() => assertStartNotPast('2026-10-09', now))).toBe(undefined);
    expect(codeOf(() => assertStartNotPast('2027-01-01', now))).toBe(undefined);
  });

  it('rejects anything earlier', () => {
    expect(codeOf(() => assertStartNotPast('2026-10-08', now))).toBe('START_DATE_IN_PAST');
  });
});
