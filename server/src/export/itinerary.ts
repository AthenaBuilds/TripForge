// Format-independent view of a trip for the PDF and Excel generators (api-contract-spec §6.5).
import { eachDate } from '@tripforge/shared';

export type ExportItem = {
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  city: string | null;
  location: string | null;
  notes: string | null;
};

export type ExportTrip = {
  destination: string;
  startDate: string;
  endDate: string;
  ownerName?: string;
  items: ExportItem[]; // already in itinerary order
};

export type ExportDay = {
  date: string;
  dayNumber: number;
  weekday: string;
  /** e.g. "Sun, 20 Dec 2026" */
  label: string;
  items: ExportItem[];
};

export const NOTHING_PLANNED = 'Nothing planned';

function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function formatDate(date: string): string {
  return parseDate(date).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatRange(startDate: string, endDate: string): string {
  return startDate === endDate
    ? formatDate(startDate)
    : `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

/** "07:00–17:00", "07:00", "until 17:00", or "" */
export function formatTimeRange(item: Pick<ExportItem, 'startTime' | 'endTime'>): string {
  if (item.startTime && item.endTime) return `${item.startTime}–${item.endTime}`;
  if (item.startTime) return item.startTime;
  if (item.endTime) return `until ${item.endTime}`;
  return '';
}

/** Every day of the trip, including days with no items. */
export function groupByDay(trip: ExportTrip): ExportDay[] {
  return eachDate(trip.startDate, trip.endDate).map((date, i) => ({
    date,
    dayNumber: i + 1,
    weekday: parseDate(date).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }),
    label: formatDate(date),
    items: trip.items.filter((item) => item.date === date),
  }));
}

/** tripforge-<destination-slug>-<startDate>.<ext> */
export function exportFilename(trip: ExportTrip, ext: 'pdf' | 'xlsx'): string {
  const slug =
    trip.destination
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'trip';
  return `tripforge-${slug}-${trip.startDate}.${ext}`;
}
