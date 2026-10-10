import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { testApp } from './test/helpers.js';

const app = testApp();

describe('GET /health', () => {
  it('returns 200 with the envelope', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body).toEqual({ data: { status: 'ok' }, error: null });
  });
});

describe('unknown routes', () => {
  it('return 404 NOT_FOUND in the envelope', async () => {
    const res = await request(app).get('/nope').expect(404);
    expect(res.body).toEqual({ data: null, error: { code: 'NOT_FOUND', message: 'Not found' } });
  });
});

describe('security headers', () => {
  it('are set by helmet', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
