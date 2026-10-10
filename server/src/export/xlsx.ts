import ExcelJS from 'exceljs';
import { NOTHING_PLANNED, formatRange, groupByDay, type ExportTrip } from './itinerary.js';

/** One sheet: Date, Day, Start, End, Title, City, Location, Notes (api-contract-spec §6.5). */
export async function renderXlsx(trip: ExportTrip): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TripForge';
  const sheet = workbook.addWorksheet('Itinerary', {
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  sheet.columns = [
    { key: 'date', width: 12 },
    { key: 'day', width: 8 },
    { key: 'start', width: 8 },
    { key: 'end', width: 8 },
    { key: 'title', width: 36 },
    { key: 'city', width: 16 },
    { key: 'location', width: 24 },
    { key: 'notes', width: 48 },
  ];

  // Header: destination and date range, then the column headings.
  sheet.addRow([`${trip.destination} — ${formatRange(trip.startDate, trip.endDate)}`]).font = {
    bold: true,
    size: 14,
  };
  sheet.addRow(trip.ownerName ? [`Planned by ${trip.ownerName}`] : []);
  const heading = sheet.addRow([
    'Date',
    'Day',
    'Start',
    'End',
    'Title',
    'City',
    'Location',
    'Notes',
  ]);
  heading.font = { bold: true };
  heading.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };

  for (const day of groupByDay(trip)) {
    if (day.items.length === 0) {
      const row = sheet.addRow([day.date, day.weekday, '', '', NOTHING_PLANNED]);
      row.getCell(5).font = { italic: true, color: { argb: 'FF777777' } };
      continue;
    }
    for (const item of day.items) {
      sheet.addRow([
        day.date,
        day.weekday,
        item.startTime ?? '',
        item.endTime ?? '',
        item.title,
        item.city ?? '',
        item.location ?? '',
        item.notes ?? '',
      ]);
    }
  }
  sheet.getColumn('notes').alignment = { wrapText: true, vertical: 'top' };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
