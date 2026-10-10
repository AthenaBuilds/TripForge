import request from 'supertest';
import { createApp, type AppOptions } from '../app.js';

/** An app with rate limits high enough that they never trigger in ordinary tests. */
export function testApp(options: AppOptions = {}) {
  return createApp({ rateLimits: { credentials: 1000, general: 1000 }, ...options });
}

let counter = 0;
export function uniqueEmail(): string {
  counter += 1;
  return `user${counter}-${Date.now()}@example.com`;
}

/** Signs up a fresh user and returns an agent that carries their session cookie. */
export async function signedInAgent(app = testApp()) {
  const agent = request.agent(app);
  const email = uniqueEmail();
  const res = await agent
    .post('/auth/signup')
    .send({ name: 'Test User', email, password: 's3cretpass' })
    .expect(201);
  return { agent, user: res.body.data.user as { id: string; email: string }, email };
}
