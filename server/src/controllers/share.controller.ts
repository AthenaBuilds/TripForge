import type { RequestHandler } from 'express';
import { exportQuerySchema, shareSlugParamsSchema, tripParamsSchema } from '@tripforge/shared';
import { toSharedTripDto } from '../lib/dto.js';
import { parse, sendData } from '../lib/http.js';
import { currentUserId } from '../middleware/requireAuth.js';
import { sendExport } from '../export/index.js';
import * as shareService from '../services/share.service.js';

export const share: RequestHandler = async (req, res) => {
  const { tripId } = parse(tripParamsSchema, req.params);
  const { shareSlug, sharedAt, created } = await shareService.shareTrip(currentUserId(req), tripId);
  sendData(res, created ? 201 : 200, { shareSlug, sharedAt: sharedAt.toISOString() });
};

export const unshare: RequestHandler = async (req, res) => {
  const { tripId } = parse(tripParamsSchema, req.params);
  await shareService.unshareTrip(currentUserId(req), tripId);
  res.status(204).end();
};

// ---------- Public, read-only (no auth; any session cookie is ignored) ----------

export const getShared: RequestHandler = async (req, res) => {
  const { slug } = parse(shareSlugParamsSchema, req.params);
  const trip = await shareService.getSharedTrip(slug);
  sendData(res, 200, { trip: toSharedTripDto(trip) });
};

export const exportShared: RequestHandler = async (req, res) => {
  const { slug } = parse(shareSlugParamsSchema, req.params);
  const { format } = parse(exportQuerySchema, req.query);
  const trip = await shareService.getSharedTrip(slug);
  await sendExport(res, toSharedTripDto(trip), format);
};
