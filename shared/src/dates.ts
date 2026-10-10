// Calendar-date helpers for `YYYY-MM-DD` strings. Dates have no time zone, so all math is done in UTC.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_MS = 86_400_000;

export function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

function toUtcMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

export function addDays(date: string, days: number): string {
  return new Date(toUtcMs(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Number of calendar days in an inclusive range, e.g. Dec 20–24 is 5. */
export function tripLengthDays(startDate: string, endDate: string): number {
  return daysBetween(startDate, endDate) + 1;
}

export function isDateInRange(date: string, startDate: string, endDate: string): boolean {
  // YYYY-MM-DD strings sort lexicographically in date order.
  return date >= startDate && date <= endDate;
}

/** Inclusive list of every date in the range. */
export function eachDate(startDate: string, endDate: string): string[] {
  const days = tripLengthDays(startDate, endDate);
  return Array.from({ length: Math.max(days, 0) }, (_, i) => addDays(startDate, i));
}
