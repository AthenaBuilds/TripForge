import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { SESSION_COOKIE } from '@tripforge/shared';
import { signedInAgent, testApp } from '../test/helpers.js';

const app = testApp();
type Agent = Awaited<ReturnType<typeof signedInAgent>>['agent'];

let owner: Agent;
let ownerEmail: string;
let stranger: Agent;
beforeAll(async () => {
  ({ agent: owner, email: ownerEmail } = await signedInAgent(app));
  stranger = (await signedInAgent(app)).agent;
});

async function createTrip() {
  const res = await owner
    .post('/trips')
    .send({
      destination: 'South India',
      startDate: '2026-12-20',
      endDate: '2026-12-28',
      items: [
        {
          title: 'Lalbagh',
          date: '2026-12-21',
          startTime: '10:00',
          endTime: '12:00',
          city: 'Bengaluru',
          location: 'Lalbagh',
        },
      ],
    })
    .expect(201);
  return res.body.data.trip as { id: string };
}

/** Collects a binary response body into a Buffer. */
function binary(res: request.Response, cb: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}

describe('POST /trips/:tripId/share', () => {
  it('creates a 22-character slug (201), then returns the same one (200)', async () => {
    const trip = await createTrip();
    const first = await owner.post(`/trips/${trip.id}/share`).expect(201);
    expect(first.body.data).toEqual({
      shareSlug: expect.stringMatching(/^[A-Za-z0-9_-]{22}$/),
      sharedAt: expect.any(String),
    });

    const again = await owner.post(`/trips/${trip.id}/share`).expect(200);
    expect(again.body.data).toEqual(first.body.data);

    const detail = await owner.get(`/trips/${trip.id}`).expect(200);
    expect(detail.body.data.trip.shareSlug).toBe(first.body.data.shareSlug);
    const list = await owner.get('/trips').expect(200);
    expect(list.body.data.trips.find((t: { id: string }) => t.id === trip.id).isShared).toBe(true);
  });

  it("returns 404 for someone else's trip", async () => {
    const trip = await createTrip();
    await stranger.post(`/trips/${trip.id}/share`).expect(404);
    await stranger.delete(`/trips/${trip.id}/share`).expect(404);
    await request(app).post(`/trips/${trip.id}/share`).expect(401);
  });
});

describe('GET /shared/:slug', () => {
  it('returns the read-only view with no private fields, without a login', async () => {
    const trip = await createTrip();
    const { shareSlug } = (await owner.post(`/trips/${trip.id}/share`)).body.data;

    const res = await request(app).get(`/shared/${shareSlug}`).expect(200);
    expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.body).toEqual({
      data: {
        trip: {
          destination: 'South India',
          startDate: '2026-12-20',
          endDate: '2026-12-28',
          ownerName: 'Test User',
          updatedAt: expect.any(String),
          items: [
            {
              title: 'Lalbagh',
              date: '2026-12-21',
              startTime: '10:00',
              endTime: '12:00',
              city: 'Bengaluru',
              location: 'Lalbagh',
              notes: null,
            },
          ],
        },
      },
      error: null,
    });
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain(trip.id);
    expect(raw).not.toContain(ownerEmail);
  });

  it('ignores an invalid session cookie', async () => {
    const trip = await createTrip();
    const { shareSlug } = (await owner.post(`/trips/${trip.id}/share`)).body.data;
    await request(app)
      .get(`/shared/${shareSlug}`)
      .set('Cookie', `${SESSION_COOKIE}=garbage`)
      .expect(200);
  });

  it('stops working after revoke, and re-sharing issues a new slug', async () => {
    const trip = await createTrip();
    const old = (await owner.post(`/trips/${trip.id}/share`)).body.data.shareSlug;

    await owner.delete(`/trips/${trip.id}/share`).expect(204);
    await owner.delete(`/trips/${trip.id}/share`).expect(204); // already revoked: still 204
    const gone = await request(app).get(`/shared/${old}`).expect(404);
    const unknown = await request(app).get('/shared/AAAAAAAAAAAAAAAAAAAAAA').expect(404);
    expect(gone.body).toEqual(unknown.body);
    expect(gone.headers['cache-control']).toBe('no-store');

    const detail = await owner.get(`/trips/${trip.id}`).expect(200);
    expect(detail.body.data.trip).toMatchObject({ shareSlug: null, sharedAt: null });

    const fresh = await owner.post(`/trips/${trip.id}/share`).expect(201);
    expect(fresh.body.data.shareSlug).not.toBe(old);
    await request(app).get(`/shared/${old}`).expect(404);
  });

  it('returns 429 RATE_LIMITED past the shared limit', async () => {
    const limited = testApp({ rateLimits: { credentials: 1000, shared: 2, general: 1000 } });
    await request(limited).get('/shared/nope').expect(404);
    await request(limited).get('/shared/nope').expect(404);
    const res = await request(limited).get('/shared/nope').expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.headers['retry-after']).toBeDefined();
  });
});

describe('exports', () => {
  const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  it.each([
    ['pdf', 'application/pdf', '%PDF-'],
    ['xlsx', XLSX, 'PK'],
  ])('owner downloads %s', async (format, type, magic) => {
    const trip = await createTrip();
    const res = await owner
      .get(`/trips/${trip.id}/export?format=${format}`)
      .buffer(true)
      .parse(binary)
      .expect(200);
    expect(res.headers['content-type']).toContain(type);
    expect(res.headers['content-disposition']).toBe(
      `attachment; filename="tripforge-south-india-2026-12-20.${format}"`,
    );
    expect((res.body as Buffer).subarray(0, magic.length).toString()).toBe(magic);
  });

  it('viewers download through the share link, without a login', async () => {
    const trip = await createTrip();
    const { shareSlug } = (await owner.post(`/trips/${trip.id}/share`)).body.data;
    const res = await request(app)
      .get(`/shared/${shareSlug}/export?format=xlsx`)
      .buffer(true)
      .parse(binary)
      .expect(200);
    expect(res.headers['content-type']).toContain(XLSX);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('returns enveloped JSON errors for bad formats, strangers, and revoked links', async () => {
    const trip = await createTrip();
    const missing = await owner.get(`/trips/${trip.id}/export`).expect(400);
    expect(missing.body.error.code).toBe('VALIDATION_ERROR');
    await owner.get(`/trips/${trip.id}/export?format=csv`).expect(400);
    await stranger.get(`/trips/${trip.id}/export?format=pdf`).expect(404);
    await request(app).get(`/trips/${trip.id}/export?format=pdf`).expect(401);
    await request(app).get('/shared/AAAAAAAAAAAAAAAAAAAAAA/export?format=pdf').expect(404);
  });
});
