import { daysBetween } from '@tripforge/shared';

/** Today's date in the user's local time zone, as YYYY-MM-DD. */
export function todayLocal(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function asUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** "Sun, 20 Dec" (adds the year when it differs from the current one). */
export function formatDay(date: string, today = todayLocal()): string {
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  return asUtc(date).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  });
}

/** "20–24 Dec 2026", "28 Dec 2026 – 3 Jan 2027", or a single day. */
export function formatDateRange(startDate: string, endDate: string): string {
  const fmt = (d: string, opts: Intl.DateTimeFormatOptions) =>
    asUtc(d).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
  const full = { day: 'numeric', month: 'short', year: 'numeric' } as const;
  if (startDate === endDate) return fmt(startDate, full);
  if (startDate.slice(0, 7) === endDate.slice(0, 7)) {
    return `${fmt(startDate, { day: 'numeric' })}–${fmt(endDate, full)}`;
  }
  if (startDate.slice(0, 4) === endDate.slice(0, 4)) {
    return `${fmt(startDate, { day: 'numeric', month: 'short' })} – ${fmt(endDate, full)}`;
  }
  return `${fmt(startDate, full)} – ${fmt(endDate, full)}`;
}

/** "Ongoing", "Starts today", "Tomorrow", "in 78 days", "Ended 3 days ago", ... */
export function relativeHint(startDate: string, endDate: string, today = todayLocal()): string {
  if (startDate <= today && today <= endDate) return 'Ongoing';
  if (startDate > today) {
    const days = daysBetween(today, startDate);
    return days === 1 ? 'Tomorrow' : `in ${days} days`;
  }
  const days = daysBetween(endDate, today);
  return days === 1 ? 'Ended yesterday' : `Ended ${days} days ago`;
}
