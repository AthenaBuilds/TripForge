import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { vi } from 'vitest';
import type { TripSummary, User } from '@tripforge/shared';
import { App } from '../App';
import { AppProviders, createQueryClient } from '../providers';

export const testUser: User = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Asha Rao',
  email: 'asha@example.com',
  createdAt: '2026-10-01T00:00:00.000Z',
};

type Reply = { status?: number; body?: unknown };
type Handler = (body: unknown) => Reply;
export type Routes = Record<string, Reply | Handler>;

/**
 * Stubs fetch with a table of "METHOD /path" -> reply. Unmatched calls fail the test loudly.
 * Envelopes are added automatically: a 2xx body becomes { data, error: null }.
 */
export function mockApi(routes: Routes) {
  const calls: Array<{ method: string; path: string; body: unknown }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const path = String(input).replace(/^\/api/, '');
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path, body });

    const route = routes[`${method} ${path}`];
    if (!route) throw new Error(`Unmocked request: ${method} ${path}`);
    const { status = 200, body: replyBody } = typeof route === 'function' ? route(body) : route;
    if (status === 204) return new Response(null, { status });
    const ok = status < 400;
    return new Response(
      JSON.stringify(ok ? { data: replyBody, error: null } : { data: null, error: replyBody }),
      {
        status,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

export const loggedIn: Routes = { 'GET /auth/me': { body: { user: testUser } } };
export const loggedOut: Routes = {
  'GET /auth/me': {
    status: 401,
    body: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
  },
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

/** Renders the full app (providers + routes) at `path`. */
export function renderApp(path: string) {
  const user = userEvent.setup();
  const utils = render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders client={createQueryClient({ retries: false })}>
        <App />
        <Routes>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </AppProviders>
    </MemoryRouter>,
  );
  return { user, ...utils };
}

export function tripSummary(overrides: Partial<TripSummary>): TripSummary {
  return {
    id: crypto.randomUUID(),
    destination: 'Goa',
    startDate: '2026-12-20',
    endDate: '2026-12-24',
    itemCount: 0,
    isShared: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}
