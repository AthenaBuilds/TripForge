import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  eachDate,
  isDateInRange,
  isValidDate,
  isValidTime,
  tripLengthDays,
} from './dates.ts';

describe('isValidDate', () => {
  it.each(['2026-12-20', '2028-02-29'])('accepts %s', (d) => expect(isValidDate(d)).toBe(true));
  it.each(['2026-02-30', '2027-02-29', '2026-13-01', '2026-1-01', '20261220', ''])(
    'rejects %s',
    (d) => expect(isValidDate(d)).toBe(false),
  );
});

describe('isValidTime', () => {
  it.each(['00:00', '09:30', '23:59'])('accepts %s', (t) => expect(isValidTime(t)).toBe(true));
  it.each(['24:00', '9:30', '12:60', '12:00:00'])('rejects %s', (t) =>
    expect(isValidTime(t)).toBe(false),
  );
});

describe('date math', () => {
  it('counts days across month and year boundaries', () => {
    expect(daysBetween('2026-12-20', '2027-01-10')).toBe(21);
    expect(daysBetween('2027-01-10', '2026-12-20')).toBe(-21);
  });

  it('adds days across a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('counts trip length inclusively', () => {
    expect(tripLengthDays('2026-12-20', '2026-12-24')).toBe(5);
    expect(tripLengthDays('2026-12-20', '2026-12-20')).toBe(1);
  });

  it('checks range membership inclusively', () => {
    expect(isDateInRange('2026-12-20', '2026-12-20', '2026-12-24')).toBe(true);
    expect(isDateInRange('2026-12-24', '2026-12-20', '2026-12-24')).toBe(true);
    expect(isDateInRange('2026-12-25', '2026-12-20', '2026-12-24')).toBe(false);
  });

  it('lists every date in the range', () => {
    expect(eachDate('2026-12-30', '2027-01-02')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
  });
});
