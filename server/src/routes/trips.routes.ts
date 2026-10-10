import { Router } from 'express';
import * as items from '../controllers/items.controller.js';
import * as share from '../controllers/share.controller.js';
import * as trips from '../controllers/trips.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';

export function tripsRoutes(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', trips.list);
  router.post('/', trips.create);
  router.get('/:tripId', trips.get);
  router.patch('/:tripId', trips.update);
  router.delete('/:tripId', trips.remove);
  router.get('/:tripId/export', trips.exportTrip);

  router.post('/:tripId/share', share.share);
  router.delete('/:tripId/share', share.unshare);

  router.post('/:tripId/items', items.create);
  router.patch('/:tripId/items/:itemId', items.update);
  router.delete('/:tripId/items/:itemId', items.remove);
  return router;
}
