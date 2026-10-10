import type { RequestHandler } from 'express';
import {
  itemParamsSchema,
  itineraryItemInputSchema,
  itineraryItemPatchSchema,
  tripParamsSchema,
} from '@tripforge/shared';
import { toItemDto } from '../lib/dto.js';
import { parse, sendData } from '../lib/http.js';
import { currentUserId } from '../middleware/requireAuth.js';
import * as itemsService from '../services/items.service.js';

export const create: RequestHandler = async (req, res) => {
  const { tripId } = parse(tripParamsSchema, req.params);
  const input = parse(itineraryItemInputSchema, req.body);
  const item = await itemsService.addItem(currentUserId(req), tripId, input);
  sendData(res, 201, { item: toItemDto(item) });
};

export const update: RequestHandler = async (req, res) => {
  const { tripId, itemId } = parse(itemParamsSchema, req.params);
  const patch = parse(itineraryItemPatchSchema, req.body);
  const item = await itemsService.updateItem(currentUserId(req), tripId, itemId, patch);
  sendData(res, 200, { item: toItemDto(item) });
};

export const remove: RequestHandler = async (req, res) => {
  const { tripId, itemId } = parse(itemParamsSchema, req.params);
  await itemsService.deleteItem(currentUserId(req), tripId, itemId);
  res.status(204).end();
};
