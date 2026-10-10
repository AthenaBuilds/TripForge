import type { RequestHandler } from 'express';
import {
  createTripInputSchema,
  exportQuerySchema,
  tripParamsSchema,
  updateTripInputSchema,
} from '@tripforge/shared';
import { sendExport } from '../export/index.js';
import { toTripDetailDto, toTripSummaryDto } from '../lib/dto.js';
import { parse, sendData } from '../lib/http.js';
import { currentUserId } from '../middleware/requireAuth.js';
import * as tripsService from '../services/trips.service.js';

export const list: RequestHandler = async (req, res) => {
  const trips = await tripsService.listTrips(currentUserId(req));
  sendData(res, 200, { trips: trips.map(toTripSummaryDto) });
};

export const create: RequestHandler = async (req, res) => {
  const input = parse(createTripInputSchema, req.body);
  const trip = await tripsService.createTrip(currentUserId(req), input);
  sendData(res, 201, { trip: toTripDetailDto(trip) });
};

export const get: RequestHandler = async (req, res) => {
  const { tripId } = parse(tripParamsSchema, req.params);
  const trip = await tripsService.getTrip(currentUserId(req), tripId);
  sendData(res, 200, { trip: toTripDetailDto(trip) });
};

export const update: RequestHandler = async (req, res) => {
  const { tripId } = parse(tripParamsSchema, req.params);
  const input = parse(updateTripInputSchema, req.body);
  const trip = await tripsService.updateTrip(currentUserId(req), tripId, input);
  sendData(res, 200, { trip: toTripDetailDto(trip) });
};

export const remove: RequestHandler = async (req, res) => {
  const { tripId } = parse(tripParamsSchema, req.params);
  await tripsService.deleteTrip(currentUserId(req), tripId);
  res.status(204).end();
};

export const exportTrip: RequestHandler = async (req, res) => {
  const { tripId } = parse(tripParamsSchema, req.params);
  const { format } = parse(exportQuerySchema, req.query);
  const trip = toTripDetailDto(await tripsService.getTrip(currentUserId(req), tripId));
  await sendExport(res, trip, format);
};
