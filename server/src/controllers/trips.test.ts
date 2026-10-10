import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../lib/db.js';
import { signedInAgent, testApp } from '../test/helpers.js';

const app = testApp();
type Agent = Awaited<ReturnType<typeof signedInAgent>>['agent'];

const goa = { destination: 'Goa', startDate: '2026-12-20', endDate: '2026-12-24' };

async function createTrip(agent: Agent, body: object = goa) {
  const res = await agent.post('/trips').send(body).expect(201);
  return res.body.data.trip;
}

let owner: Agent;
let stranger: Agent;
beforeAll(async () => {
  owner = (await signedInAgent(app)).agent;
  stranger = (await signedInAgent(app)).agent;
});

describe('auth', () => {
  it('requires a session on every /trips route', async () => {
    const res = await request(app).get('/trips').expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    await request(app).post('/trips').send(goa).expect(401);
  });
});

describe('POST /trips', () => {
  it('creates a trip with its items, sorted per the contract', async () => {
    const trip = await createTrip(owner, {
      ...goa,
      items: [
        { title: 'Dinner', date: '2026-12-21', startTime: '19:00' },
        { title: 'Beach (no time)', date: '2026-12-21' },
        {
          title: 'Check in',
          date: '2026-12-20',
          startTime: '14:00',
          city: 'Goa',
          location: 'Candolim',
        },
        { title: 'Breakfast', date: '2026-12-21', startTime: '08:00', endTime: '09:00' },
      ],
    });

    expect(trip).toMatchObject({
      ...goa,
      shareSlug: null,
      sharedAt: null,
      id: expect.any(String),
      createdAt: expect.any(String),
    });
    expect(trip.items.map((i: { title: string }) => i.title)).toEqual([
      'Check in',
      'Beach (no time)',
      'Breakfast',
      'Dinner',
    ]);
    expect(trip.items[0]).toEqual({
      id: expect.any(String),
      tripId: trip.id,
      title: 'Check in',
      date: '2026-12-20',
      startTime: '14:00',
      endTime: null,
      city: 'Goa',
      location: 'Candolim',
      notes: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it('defaults to no items', async () => {
    const trip = await createTrip(owner);
    expect(trip.items).toEqual([]);
  });

  it.each([
    ['endDate before startDate', { ...goa, endDate: '2026-12-19' }, 'DATE_RANGE_INVALID'],
    ['a trip over 60 days', { ...goa, endDate: '2027-02-28' }, 'DATE_RANGE_INVALID'],
    [
      'an item outside the trip',
      { ...goa, items: [{ title: 'x', date: '2026-12-25' }] },
      'ITEM_DATE_OUT_OF_RANGE',
    ],
    [
      'an item ending before it starts',
      { ...goa, items: [{ title: 'x', date: '2026-12-21', startTime: '10:00', endTime: '09:00' }] },
      'ITEM_TIME_INVALID',
    ],
    [
      '201 items',
      { ...goa, items: Array.from({ length: 201 }, () => ({ title: 'x', date: '2026-12-21' })) },
      'ITEM_LIMIT_REACHED',
    ],
  ])('rejects %s with 422 and saves nothing', async (_label, body, code) => {
    const before = await prisma.trip.count();
    const res = await owner.post('/trips').send(body).expect(422);
    expect(res.body.error.code).toBe(code);
    expect(await prisma.trip.count()).toBe(before);
  });

  it('names the failing item in item rule errors', async () => {
    const res = await owner
      .post('/trips')
      .send({
        ...goa,
        items: [
          { title: 'ok', date: '2026-12-20' },
          { title: 'bad', date: '2027-01-01' },
        ],
      })
      .expect(422);
    expect(res.body.error.message).toMatch(/^items\[1\]/);
  });

  it('reports item validation errors with items[n].field paths', async () => {
    const res = await owner
      .post('/trips')
      .send({ ...goa, items: [{ title: 'ok', date: '2026-12-20' }, { date: '2026-12-21' }] })
      .expect(400);
    expect(res.body.error.details).toEqual([
      { field: 'items[1].title', message: expect.any(String) },
    ]);
  });
});

describe('GET /trips', () => {
  it('lists only my trips as summaries, by startDate', async () => {
    const { agent } = await signedInAgent(app);
    await createTrip(agent, {
      destination: 'Later',
      startDate: '2027-03-01',
      endDate: '2027-03-02',
    });
    await createTrip(agent, {
      destination: 'Sooner',
      startDate: '2026-11-01',
      endDate: '2026-11-02',
      items: [
        { title: 'a', date: '2026-11-01' },
        { title: 'b', date: '2026-11-02' },
      ],
    });
    await createTrip(stranger, {
      destination: 'Not mine',
      startDate: '2026-10-20',
      endDate: '2026-10-20',
    });

    const res = await agent.get('/trips').expect(200);
    expect(res.body.data.trips.map((t: { destination: string }) => t.destination)).toEqual([
      'Sooner',
      'Later',
    ]);
    expect(res.body.data.trips[0]).toEqual({
      id: expect.any(String),
      destination: 'Sooner',
      startDate: '2026-11-01',
      endDate: '2026-11-02',
      itemCount: 2,
      isShared: false,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it('returns an empty list for a new user', async () => {
    const { agent } = await signedInAgent(app);
    const res = await agent.get('/trips').expect(200);
    expect(res.body).toEqual({ data: { trips: [] }, error: null });
  });
});

describe('GET /trips/:tripId', () => {
  it('returns 400 for a non-UUID id', async () => {
    const res = await owner.get('/trips/not-a-uuid').expect(400);
    expect(res.body.error.details[0].field).toBe('tripId');
  });

  it('returns 404 for an unknown id', async () => {
    await owner.get(`/trips/${crypto.randomUUID()}`).expect(404);
  });
});

describe('PATCH /trips/:tripId', () => {
  const items = [
    { title: 'first', date: '2026-12-20', startTime: '10:00' },
    { title: 'last', date: '2026-12-24', notes: 'keep me' },
  ];

  it('updates the destination alone', async () => {
    const trip = await createTrip(owner);
    const res = await owner
      .patch(`/trips/${trip.id}`)
      .send({ destination: 'North Goa' })
      .expect(200);
    expect(res.body.data.trip).toMatchObject({ ...goa, destination: 'North Goa' });
  });

  it('extends dates when items still fit', async () => {
    const trip = await createTrip(owner, { ...goa, items });
    const res = await owner.patch(`/trips/${trip.id}`).send({ endDate: '2026-12-28' }).expect(200);
    expect(res.body.data.trip.endDate).toBe('2026-12-28');
    expect(res.body.data.trip.items.map((i: { date: string }) => i.date)).toEqual([
      '2026-12-20',
      '2026-12-24',
    ]);
  });

  it('rejects a change that strands items, listing them, and changes nothing', async () => {
    const trip = await createTrip(owner, { ...goa, items });
    const res = await owner
      .patch(`/trips/${trip.id}`)
      .send({ destination: 'Elsewhere', startDate: '2026-12-21' })
      .expect(422);

    expect(res.body.error.code).toBe('ITEMS_OUT_OF_RANGE');
    expect(res.body.error.details).toEqual([
      {
        field: 'items',
        message: '1 item falls outside the new dates',
        itemIds: [trip.items[0].id],
      },
    ]);
    const after = await owner.get(`/trips/${trip.id}`).expect(200);
    expect(after.body.data.trip).toMatchObject(goa);
  });

  it('shifts every item with shiftItems, keeping times and notes', async () => {
    const trip = await createTrip(owner, { ...goa, items });
    const res = await owner
      .patch(`/trips/${trip.id}`)
      .send({ startDate: '2027-01-10', endDate: '2027-01-14', shiftItems: true })
      .expect(200);

    expect(res.body.data.trip).toMatchObject({ startDate: '2027-01-10', endDate: '2027-01-14' });
    expect(res.body.data.trip.items).toMatchObject([
      { title: 'first', date: '2027-01-10', startTime: '10:00' },
      { title: 'last', date: '2027-01-14', notes: 'keep me' },
    ]);
  });

  it('rolls back the whole update when shifted items still do not fit', async () => {
    const trip = await createTrip(owner, { ...goa, items });
    const res = await owner
      .patch(`/trips/${trip.id}`)
      .send({ startDate: '2027-01-10', endDate: '2027-01-12', shiftItems: true })
      .expect(422);
    expect(res.body.error.details[0].itemIds).toEqual([trip.items[1].id]);

    const after = await owner.get(`/trips/${trip.id}`).expect(200);
    expect(after.body.data.trip.items.map((i: { date: string }) => i.date)).toEqual([
      '2026-12-20',
      '2026-12-24',
    ]);
  });

  it('rejects an invalid range and an empty patch', async () => {
    const trip = await createTrip(owner);
    const bad = await owner.patch(`/trips/${trip.id}`).send({ endDate: '2026-12-01' }).expect(422);
    expect(bad.body.error.code).toBe('DATE_RANGE_INVALID');
    await owner.patch(`/trips/${trip.id}`).send({ shiftItems: true }).expect(400);
  });
});

describe('DELETE /trips/:tripId', () => {
  it('deletes the trip and its items', async () => {
    const trip = await createTrip(owner, { ...goa, items: [{ title: 'x', date: '2026-12-20' }] });
    const res = await owner.delete(`/trips/${trip.id}`).expect(204);
    expect(res.text).toBe('');
    await owner.get(`/trips/${trip.id}`).expect(404);
    expect(await prisma.itineraryItem.count({ where: { tripId: trip.id } })).toBe(0);
  });
});

describe('cross-user isolation', () => {
  it("returns 404 for every operation on someone else's trip, and changes nothing", async () => {
    const trip = await createTrip(owner, {
      ...goa,
      items: [{ title: 'mine', date: '2026-12-20' }],
    });
    const itemId = trip.items[0].id;
    const unknown = await owner.get(`/trips/${crypto.randomUUID()}`);

    const responses = await Promise.all([
      stranger.get(`/trips/${trip.id}`),
      stranger.patch(`/trips/${trip.id}`).send({ destination: 'Hacked' }),
      stranger.delete(`/trips/${trip.id}`),
      stranger.post(`/trips/${trip.id}/items`).send({ title: 'x', date: '2026-12-20' }),
      stranger.patch(`/trips/${trip.id}/items/${itemId}`).send({ title: 'Hacked' }),
      stranger.delete(`/trips/${trip.id}/items/${itemId}`),
    ]);
    for (const res of responses) {
      expect(res.status).toBe(404);
      // Identical to a trip that doesn't exist: nothing reveals that it does.
      expect(res.body).toEqual(unknown.body);
    }

    const after = await owner.get(`/trips/${trip.id}`).expect(200);
    expect(after.body.data.trip.destination).toBe('Goa');
    expect(after.body.data.trip.items).toMatchObject([{ id: itemId, title: 'mine' }]);
  });
});
