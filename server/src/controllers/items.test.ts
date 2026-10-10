import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../lib/db.js';
import { signedInAgent, testApp } from '../test/helpers.js';

const app = testApp();
type Agent = Awaited<ReturnType<typeof signedInAgent>>['agent'];

let agent: Agent;
let tripId: string;
beforeAll(async () => {
  agent = (await signedInAgent(app)).agent;
  const res = await agent
    .post('/trips')
    .send({ destination: 'Goa', startDate: '2026-12-20', endDate: '2026-12-24' })
    .expect(201);
  tripId = res.body.data.trip.id;
});

const dudhsagar = {
  title: 'Dudhsagar Falls day trip',
  date: '2026-12-22',
  startTime: '07:00',
  endTime: '17:00',
  city: 'Goa',
  location: 'Dudhsagar',
  notes: 'Book jeep safari in advance',
};

async function addItem(body: object = dudhsagar) {
  const res = await agent.post(`/trips/${tripId}/items`).send(body).expect(201);
  return res.body.data.item;
}

describe('POST /trips/:tripId/items', () => {
  it('adds an item and bumps the trip updatedAt', async () => {
    const before = await prisma.trip.findUniqueOrThrow({ where: { id: tripId } });
    const item = await addItem();
    expect(item).toEqual({
      ...dudhsagar,
      id: expect.any(String),
      tripId,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    const after = await prisma.trip.findUniqueOrThrow({ where: { id: tripId } });
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  it('fills omitted optional fields with null', async () => {
    const item = await addItem({ title: 'Walk', date: '2026-12-20' });
    expect(item).toMatchObject({
      startTime: null,
      endTime: null,
      city: null,
      location: null,
      notes: null,
    });
  });

  it.each([
    ['a date outside the trip', { title: 'x', date: '2026-12-25' }, 'ITEM_DATE_OUT_OF_RANGE'],
    [
      'start after end',
      { title: 'x', date: '2026-12-21', startTime: '10:00', endTime: '09:59' },
      'ITEM_TIME_INVALID',
    ],
  ])('rejects %s with 422', async (_label, body, code) => {
    const res = await agent.post(`/trips/${tripId}/items`).send(body).expect(422);
    expect(res.body.error.code).toBe(code);
  });

  it('rejects the 201st item', async () => {
    const { agent: other } = await signedInAgent(app);
    const trip = (
      await other
        .post('/trips')
        .send({
          destination: 'Full',
          startDate: '2026-12-20',
          endDate: '2026-12-20',
          items: Array.from({ length: 200 }, (_, i) => ({ title: `#${i}`, date: '2026-12-20' })),
        })
        .expect(201)
    ).body.data.trip;
    const res = await other
      .post(`/trips/${trip.id}/items`)
      .send({ title: 'one too many', date: '2026-12-20' })
      .expect(422);
    expect(res.body.error.code).toBe('ITEM_LIMIT_REACHED');
  });
});

describe('PATCH /trips/:tripId/items/:itemId', () => {
  it('applies a partial update and clears fields sent as null', async () => {
    const item = await addItem();
    const res = await agent
      .patch(`/trips/${tripId}/items/${item.id}`)
      .send({ startTime: '08:00', notes: null })
      .expect(200);
    expect(res.body.data.item).toMatchObject({
      ...dudhsagar,
      startTime: '08:00',
      notes: null,
      id: item.id,
    });
  });

  it('checks the time rule against the merged item', async () => {
    const item = await addItem(); // 07:00–17:00
    const res = await agent
      .patch(`/trips/${tripId}/items/${item.id}`)
      .send({ startTime: '18:00' })
      .expect(422);
    expect(res.body.error.code).toBe('ITEM_TIME_INVALID');

    // Clearing endTime makes a later startTime valid.
    await agent
      .patch(`/trips/${tripId}/items/${item.id}`)
      .send({ startTime: '18:00', endTime: null })
      .expect(200);
  });

  it('rejects moving an item outside the trip', async () => {
    const item = await addItem();
    const res = await agent
      .patch(`/trips/${tripId}/items/${item.id}`)
      .send({ date: '2026-12-19' })
      .expect(422);
    expect(res.body.error.code).toBe('ITEM_DATE_OUT_OF_RANGE');
  });

  it('rejects an empty patch and unknown fields with 400', async () => {
    const item = await addItem();
    await agent.patch(`/trips/${tripId}/items/${item.id}`).send({}).expect(400);
    const res = await agent
      .patch(`/trips/${tripId}/items/${item.id}`)
      .send({ tripId: crypto.randomUUID() })
      .expect(400);
    expect(res.body.error.details).toEqual([{ field: 'tripId', message: 'Unknown field' }]);
  });

  it('returns 404 when the item belongs to a different trip of mine', async () => {
    const item = await addItem();
    const other = (
      await agent
        .post('/trips')
        .send({ destination: 'Other', startDate: '2026-12-20', endDate: '2026-12-24' })
        .expect(201)
    ).body.data.trip;
    await agent.patch(`/trips/${other.id}/items/${item.id}`).send({ title: 'moved?' }).expect(404);
    await agent.delete(`/trips/${other.id}/items/${item.id}`).expect(404);
  });
});

describe('DELETE /trips/:tripId/items/:itemId', () => {
  it('removes the item, then 404s on a repeat', async () => {
    const item = await addItem();
    await agent.delete(`/trips/${tripId}/items/${item.id}`).expect(204);
    await agent.delete(`/trips/${tripId}/items/${item.id}`).expect(404);
    expect(await prisma.itineraryItem.findUnique({ where: { id: item.id } })).toBeNull();
  });
});

describe('PUT /trips/:tripId/items (Update Trip)', () => {
  async function freshTrip(items: object[]) {
    const res = await agent
      .post('/trips')
      .send({ destination: 'Bulk', startDate: '2026-12-20', endDate: '2026-12-24', items })
      .expect(201);
    return res.body.data.trip as {
      id: string;
      items: Array<{ id: string; title: string; createdAt: string }>;
    };
  }

  it('updates, creates, and deletes in one call, keeping ids of kept items', async () => {
    const trip = await freshTrip([
      { title: 'keep', date: '2026-12-20', notes: 'old note' },
      { title: 'drop', date: '2026-12-21' },
    ]);
    const kept = trip.items.find((i) => i.title === 'keep')!;

    const res = await agent
      .put(`/trips/${trip.id}/items`)
      .send({
        items: [
          { id: kept.id, title: 'kept + edited', date: '2026-12-22', startTime: '09:00' },
          { title: 'brand new', date: '2026-12-20' },
        ],
      })
      .expect(200);

    const items = res.body.data.trip.items;
    expect(items.map((i: { title: string }) => i.title)).toEqual(['brand new', 'kept + edited']);
    const edited = items.find((i: { id: string }) => i.id === kept.id);
    // Full replacement: omitted optional fields are cleared; identity is preserved.
    expect(edited).toMatchObject({
      title: 'kept + edited',
      date: '2026-12-22',
      startTime: '09:00',
      notes: null,
    });
    expect(edited.createdAt).toBe(kept.createdAt);
    expect(await prisma.itineraryItem.count({ where: { tripId: trip.id } })).toBe(2);
  });

  it('an empty list removes every item', async () => {
    const trip = await freshTrip([{ title: 'a', date: '2026-12-20' }]);
    const res = await agent.put(`/trips/${trip.id}/items`).send({ items: [] }).expect(200);
    expect(res.body.data.trip.items).toEqual([]);
  });

  it('saves nothing when any item breaks a rule, naming the item', async () => {
    const trip = await freshTrip([{ title: 'original', date: '2026-12-20' }]);
    const res = await agent
      .put(`/trips/${trip.id}/items`)
      .send({
        items: [
          { id: trip.items[0]!.id, title: 'changed', date: '2026-12-20' },
          { title: 'bad', date: '2026-12-21', startTime: '10:00', endTime: '09:00' },
        ],
      })
      .expect(422);
    expect(res.body.error.code).toBe('ITEM_TIME_INVALID');
    expect(res.body.error.message).toMatch(/^items\[1\]/);

    const after = await agent.get(`/trips/${trip.id}`).expect(200);
    expect(after.body.data.trip.items.map((i: { title: string }) => i.title)).toEqual(['original']);
  });

  it('404s for an id from another trip and leaves both trips unchanged', async () => {
    const a = await freshTrip([{ title: 'a1', date: '2026-12-20' }]);
    const b = await freshTrip([{ title: 'b1', date: '2026-12-20' }]);
    await agent
      .put(`/trips/${a.id}/items`)
      .send({ items: [{ id: b.items[0]!.id, title: 'stolen', date: '2026-12-20' }] })
      .expect(404);
    expect((await agent.get(`/trips/${a.id}`)).body.data.trip.items[0].title).toBe('a1');
    expect((await agent.get(`/trips/${b.id}`)).body.data.trip.items[0].title).toBe('b1');
  });

  it("404s on someone else's trip and 400s on duplicate ids", async () => {
    const trip = await freshTrip([{ title: 'a', date: '2026-12-20' }]);
    const { agent: other } = await signedInAgent(app);
    await other.put(`/trips/${trip.id}/items`).send({ items: [] }).expect(404);

    const id = trip.items[0]!.id;
    const dup = await agent
      .put(`/trips/${trip.id}/items`)
      .send({
        items: [
          { id, title: 'x', date: '2026-12-20' },
          { id, title: 'y', date: '2026-12-20' },
        ],
      })
      .expect(400);
    expect(dup.body.error.details).toEqual([
      { field: 'items[1].id', message: 'duplicate item id' },
    ]);
  });
});
