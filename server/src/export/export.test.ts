import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  exportFilename,
  formatRange,
  formatTimeRange,
  groupByDay,
  type ExportTrip,
} from './itinerary.js';
import { renderPdf } from './pdf.js';
import { renderXlsx } from './xlsx.js';

const trip: ExportTrip = {
  destination: 'South India',
  startDate: '2026-12-20',
  endDate: '2026-12-22',
  ownerName: 'Asha Rao',
  items: [
    {
      title: 'Check in',
      date: '2026-12-20',
      startTime: '14:00',
      endTime: null,
      city: 'Bengaluru',
      location: 'MG Road',
      notes: null,
    },
    {
      title: 'Lalbagh',
      date: '2026-12-20',
      startTime: '16:00',
      endTime: '18:00',
      city: 'Bengaluru',
      location: 'Lalbagh',
      notes: 'Bring water',
    },
    {
      title: 'Palace',
      date: '2026-12-22',
      startTime: null,
      endTime: null,
      city: 'Mysuru',
      location: null,
      notes: null,
    },
  ],
};

describe('itinerary helpers', () => {
  it('groups items by day, including empty days', () => {
    const days = groupByDay(trip);
    expect(days.map((d) => [d.date, d.dayNumber, d.weekday, d.items.length])).toEqual([
      ['2026-12-20', 1, 'Sun', 2],
      ['2026-12-21', 2, 'Mon', 0],
      ['2026-12-22', 3, 'Tue', 1],
    ]);
  });

  it('formats time ranges', () => {
    expect(formatTimeRange({ startTime: '07:00', endTime: '17:00' })).toBe('07:00–17:00');
    expect(formatTimeRange({ startTime: '07:00', endTime: null })).toBe('07:00');
    expect(formatTimeRange({ startTime: null, endTime: '17:00' })).toBe('until 17:00');
    expect(formatTimeRange({ startTime: null, endTime: null })).toBe('');
  });

  it('formats date ranges', () => {
    expect(formatRange('2026-12-20', '2026-12-22')).toBe('Sun, 20 Dec 2026 – Tue, 22 Dec 2026');
    expect(formatRange('2026-12-20', '2026-12-20')).toBe('Sun, 20 Dec 2026');
  });

  it.each([
    ['South India', 'tripforge-south-india-2026-12-20.pdf'],
    ['  Café / Zürich!! ', 'tripforge-cafe-zurich-2026-12-20.pdf'],
    ['東京', 'tripforge-trip-2026-12-20.pdf'],
  ])('builds a safe filename for %j', (destination, expected) => {
    expect(exportFilename({ ...trip, destination }, 'pdf')).toBe(expected);
  });
});

describe('renderPdf', () => {
  it('produces a PDF', async () => {
    const pdf = await renderPdf(trip);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('handles a long 60-day trip across pages', async () => {
    const long: ExportTrip = {
      ...trip,
      endDate: '2027-02-17',
      items: Array.from({ length: 200 }, (_, i) => ({
        ...trip.items[1]!,
        title: `Item ${i}`,
        date: '2026-12-25',
      })),
    };
    const pdf = await renderPdf(long);
    const pages = pdf.toString('latin1').match(/\/Type \/Page\b/g)?.length ?? 0;
    expect(pages).toBeGreaterThan(5);
  });
});

describe('renderXlsx', () => {
  it('writes the header, column headings, and one row per item or empty day', async () => {
    const workbook = new ExcelJS.Workbook();
    const file = await renderXlsx(trip);
    await workbook.xlsx.load(
      file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer,
    );
    const sheet = workbook.getWorksheet('Itinerary')!;
    const rows = sheet
      .getSheetValues()
      .slice(1)
      .map((r) => (Array.isArray(r) ? r.slice(1) : []));

    expect(rows[0]![0]).toBe('South India — Sun, 20 Dec 2026 – Tue, 22 Dec 2026');
    expect(rows[1]![0]).toBe('Planned by Asha Rao');
    expect(rows[2]).toEqual(['Date', 'Day', 'Start', 'End', 'Title', 'City', 'Location', 'Notes']);
    expect(rows.slice(3)).toEqual([
      ['2026-12-20', 'Sun', '14:00', '', 'Check in', 'Bengaluru', 'MG Road', ''],
      ['2026-12-20', 'Sun', '16:00', '18:00', 'Lalbagh', 'Bengaluru', 'Lalbagh', 'Bring water'],
      ['2026-12-21', 'Mon', '', '', 'Nothing planned'],
      ['2026-12-22', 'Tue', '', '', 'Palace', 'Mysuru', '', ''],
    ]);
  });
});
