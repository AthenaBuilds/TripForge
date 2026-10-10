import type { Response } from 'express';
import type { ExportFormat } from '@tripforge/shared';
import { exportFilename, type ExportTrip } from './itinerary.js';
import { renderPdf } from './pdf.js';
import { renderXlsx } from './xlsx.js';

const CONTENT_TYPES: Record<ExportFormat, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** Render the trip and send it as a download (no JSON envelope). */
export async function sendExport(res: Response, trip: ExportTrip, format: ExportFormat) {
  const file = format === 'pdf' ? await renderPdf(trip) : await renderXlsx(trip);
  // exportFilename only produces [a-z0-9.-], so it is safe to quote as-is.
  res.set({
    'Content-Type': CONTENT_TYPES[format],
    'Content-Disposition': `attachment; filename="${exportFilename(trip, format)}"`,
  });
  res.send(file);
}
