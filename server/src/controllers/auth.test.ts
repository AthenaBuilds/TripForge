import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { SESSION_COOKIE } from '@tripforge/shared';
import { prisma } from '../lib/db.js';
import { signSession } from '../lib/session.js';
import { signedInAgent, testApp, uniqueEmail } from '../test/helpers.js';

const app = testApp();

function sessionCookie(res: request.Response): string | undefined {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  return cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
}

describe('POST /auth/signup', () => {
  it('creates the user, sets the session cookie, and normalizes input', async () => {
    const email = uniqueEmail();
    const res = await request(app)
      .post('/auth/signup')
      .send({ name: '  Asha Rao ', email: email.toUpperCase(), password: 's3cretpass' })
      .expect(201);

    expect(res.body.error).toBeNull();
    expect(res.body.data.user).toEqual({
      id: expect.any(String),
      name: 'Asha Rao',
      email,
      createdAt: expect.any(String),
    });
    expect(res.body.data.user).not.toHaveProperty('passwordHash');

    const cookie = sessionCookie(res);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Max-Age=604800/);
    expect(cookie).toMatch(/Path=\//);

    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(stored.passwordHash).toMatch(/^\$2b\$12\$/);
  });

  it('rejects a duplicate email with 409 EMAIL_TAKEN, case-insensitively', async () => {
    const email = uniqueEmail();
    await request(app).post('/auth/signup').send({ name: 'A', email, password: 's3cretpass' });
    const res = await request(app)
      .post('/auth/signup')
      .send({ name: 'B', email: email.toUpperCase(), password: 'otherpass1' })
      .expect(409);
    expect(res.body).toEqual({
      data: null,
      error: { code: 'EMAIL_TAKEN', message: expect.any(String) },
    });
  });

  it('returns 400 VALIDATION_ERROR with field details', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ name: '', email: 'not-an-email', password: 'short', role: 'admin' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d: { field: string }) => d.field).sort();
    expect(fields).toEqual(['email', 'name', 'password', 'role']);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .set('Content-Type', 'application/json')
      .send('{"name":')
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /auth/login', () => {
  it('logs in with the right password, ignoring email case', async () => {
    const { email } = await signedInAgent(app);
    const res = await request(app)
      .post('/auth/login')
      .send({ email: email.toUpperCase(), password: 's3cretpass' })
      .expect(200);
    expect(res.body.data.user.email).toBe(email);
    expect(sessionCookie(res)).toBeDefined();
  });

  it('returns the same 401 for a wrong password and an unknown email', async () => {
    const { email } = await signedInAgent(app);
    const wrongPassword = await request(app)
      .post('/auth/login')
      .send({ email, password: 'wrongpass1' })
      .expect(401);
    const unknownEmail = await request(app)
      .post('/auth/login')
      .send({ email: uniqueEmail(), password: 's3cretpass' })
      .expect(401);

    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(unknownEmail.body).toEqual(wrongPassword.body);
    expect(sessionCookie(wrongPassword)).toBeUndefined();
  });
});

describe('GET /auth/me and POST /auth/logout', () => {
  it('returns the current user, then 401 after logout', async () => {
    const { agent, user } = await signedInAgent(app);

    const me = await agent.get('/auth/me').expect(200);
    expect(me.body.data.user.id).toBe(user.id);

    const logout = await agent.post('/auth/logout').expect(204);
    expect(logout.text).toBe('');
    expect(sessionCookie(logout)).toMatch(/Expires=Thu, 01 Jan 1970/);

    const after = await agent.get('/auth/me').expect(401);
    expect(after.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('logout succeeds without a session', async () => {
    await request(app).post('/auth/logout').expect(204);
  });

  it.each([
    ['no cookie', undefined],
    ['a garbage token', `${SESSION_COOKIE}=not-a-jwt`],
    ['a token for a deleted user', `${SESSION_COOKIE}=${signSession(crypto.randomUUID())}`],
  ])('returns 401 UNAUTHENTICATED with %s', async (_label, cookie) => {
    const req = request(app).get('/auth/me');
    if (cookie) req.set('Cookie', cookie);
    const res = await req.expect(401);
    expect(res.body).toEqual({
      data: null,
      error: { code: 'UNAUTHENTICATED', message: expect.any(String) },
    });
  });
});

describe('rate limiting', () => {
  it('returns 429 RATE_LIMITED with Retry-After after too many login attempts', async () => {
    const limited = testApp({ rateLimits: { credentials: 2, general: 1000 } });
    const attempt = () =>
      request(limited).post('/auth/login').send({ email: uniqueEmail(), password: 'x' });

    await attempt().expect(401);
    await attempt().expect(401);
    const res = await attempt().expect(429);

    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.headers['retry-after']).toBeDefined();
    expect(res.headers['ratelimit-policy']).toBeDefined();
  });
});
