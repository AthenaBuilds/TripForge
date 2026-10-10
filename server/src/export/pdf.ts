import PDFDocument from 'pdfkit';
import {
  NOTHING_PLANNED,
  formatRange,
  formatTimeRange,
  groupByDay,
  type ExportTrip,
} from './itinerary.js';

const MARGIN = 50;
const TIME_COL = 80;
const MUTED = '#555555';

export function renderPdf(trip: ExportTrip): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: MARGIN,
    info: { Title: `${trip.destination} itinerary`, Creator: 'TripForge' },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const width = doc.page.width - MARGIN * 2;

  // Header: destination and date range.
  doc.font('Helvetica-Bold').fontSize(22).text(trip.destination, { width });
  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor(MUTED)
    .text(formatRange(trip.startDate, trip.endDate));
  if (trip.ownerName) doc.text(`Planned by ${trip.ownerName}`);
  doc.fillColor('black').moveDown(1);

  for (const day of groupByDay(trip)) {
    // Keep a day heading with at least its first line.
    if (doc.y > doc.page.height - MARGIN - 60) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(13).text(`Day ${day.dayNumber} · ${day.label}`);
    doc
      .moveTo(MARGIN, doc.y + 2)
      .lineTo(MARGIN + width, doc.y + 2)
      .strokeColor('#cccccc')
      .stroke();
    doc.moveDown(0.5);

    if (day.items.length === 0) {
      doc.font('Helvetica-Oblique').fontSize(10).fillColor(MUTED).text(NOTHING_PLANNED);
      doc.fillColor('black');
    }

    for (const item of day.items) {
      const top = doc.y;
      doc.font('Helvetica').fontSize(10).fillColor(MUTED);
      doc.text(formatTimeRange(item) || '—', MARGIN, top, { width: TIME_COL - 8 });

      const x = MARGIN + TIME_COL;
      const w = width - TIME_COL;
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('black')
        .text(item.title, x, top, { width: w });
      const place = [item.city, item.location].filter(Boolean).join(' · ');
      doc.font('Helvetica').fontSize(10);
      if (place) doc.fillColor(MUTED).text(place, x, doc.y, { width: w });
      if (item.notes) doc.fillColor('black').text(item.notes, x, doc.y, { width: w });
      doc.x = MARGIN;
      doc.moveDown(0.6);
    }
    doc.fillColor('black').moveDown(0.6);
  }

  doc.end();
  return done;
}
