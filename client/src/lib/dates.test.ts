import { describe, expect, it } from 'vitest';
import { formatDateRange, relativeHint, todayLocal } from './dates';

describe('todayLocal', () => {
  it('uses the local calendar date', () => {
    expect(todayLocal(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});

describe('formatDateRange', () => {
  it.each([
    ['2026-12-20', '2026-12-24', '20–24 Dec 2026'],
    ['2026-11-28', '2026-12-03', '28 Nov – 3 Dec 2026'],
    ['2026-12-28', '2027-01-03', '28 Dec 2026 – 3 Jan 2027'],
    ['2026-12-20', '2026-12-20', '20 Dec 2026'],
  ])('%s..%s -> %s', (start, end, expected) => {
    expect(formatDateRange(start, end)).toBe(expected);
  });
});

describe('relativeHint', () => {
  const today = '2026-10-10';
  it.each([
    ['2026-10-08', '2026-10-12', 'Ongoing'],
    ['2026-10-10', '2026-10-10', 'Ongoing'],
    ['2026-10-11', '2026-10-12', 'Tomorrow'],
    ['2026-12-27', '2026-12-29', 'in 78 days'],
    ['2026-10-01', '2026-10-09', 'Ended yesterday'],
    ['2026-09-01', '2026-09-07', 'Ended 33 days ago'],
  ])('%s..%s -> %s', (start, end, expected) => {
    expect(relativeHint(start, end, today)).toBe(expected);
  });
});
