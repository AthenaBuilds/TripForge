import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { loggedIn, loggedOut, mockApi, renderApp, testUser } from '../test/render';

const location = () => screen.getByTestId('location').textContent;

describe('ProtectedRoute', () => {
  it('redirects to the Welcome page when logged out', async () => {
    mockApi(loggedOut);
    renderApp('/trips');
    expect(await screen.findByRole('heading', { name: 'TripForge' })).toBeInTheDocument();
    expect(screen.getByText('From Ideas to Itinerary')).toBeInTheDocument();
    expect(location()).toBe('/');
  });

  it('shows the dashboard when the session is restored', async () => {
    mockApi({ ...loggedIn, 'GET /trips': { body: { trips: [] } } });
    renderApp('/trips');
    expect(await screen.findByText('No trips so far')).toBeInTheDocument();
    expect(screen.getByText(testUser.name)).toBeInTheDocument();
  });

  it('sends a logged-in user from / to /trips', async () => {
    mockApi({ ...loggedIn, 'GET /trips': { body: { trips: [] } } });
    renderApp('/');
    await waitFor(() => expect(location()).toBe('/trips'));
  });

  it('shows the Welcome page without waiting for a slow session check', async () => {
    // GET /auth/me never answers, like a cold-starting API.
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
    renderApp('/');
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();
  });

  it('clears the session and returns to / when an API call gets 401', async () => {
    mockApi({
      ...loggedIn,
      'GET /trips': { status: 401, body: { code: 'UNAUTHENTICATED', message: 'expired' } },
    });
    renderApp('/trips');
    await waitFor(() => expect(location()).toBe('/'));
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });
});

describe('AuthForm', () => {
  it('validates fields inline before submitting', async () => {
    const { calls } = mockApi(loggedOut);
    const { user } = renderApp('/');
    await user.click(await screen.findByRole('button', { name: 'Log in' }));

    expect(screen.getByText('Enter your email.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(calls.filter((c) => c.path === '/auth/login')).toHaveLength(0);
  });

  it('logs in and goes to /trips', async () => {
    const { calls } = mockApi({
      ...loggedOut,
      'POST /auth/login': { body: { user: testUser } },
      'GET /trips': { body: { trips: [] } },
    });
    const { user } = renderApp('/');
    await user.type(await screen.findByLabelText('Email'), ' Asha@Example.com ');
    await user.type(screen.getByLabelText('Password'), 's3cretpass');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(location()).toBe('/trips'));
    expect(calls.find((c) => c.path === '/auth/login')?.body).toEqual({
      email: 'asha@example.com',
      password: 's3cretpass',
    });
  });

  it('shows a friendly message for wrong credentials', async () => {
    mockApi({
      ...loggedOut,
      'POST /auth/login': {
        status: 401,
        body: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect' },
      },
    });
    const { user } = renderApp('/');
    await user.type(await screen.findByLabelText('Email'), 'asha@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    expect(location()).toBe('/');
  });

  it('toggles to signup, enforces the password length, and signs up', async () => {
    const { calls } = mockApi({
      ...loggedOut,
      'POST /auth/signup': { status: 201, body: { user: testUser } },
      'GET /trips': { body: { trips: [] } },
    });
    const { user } = renderApp('/');
    await user.click(await screen.findByRole('button', { name: 'Create an account' }));
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Name'), 'Asha Rao');
    await user.type(screen.getByLabelText('Email'), 'asha@example.com');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Password'), 'enough');
    await user.click(screen.getByRole('button', { name: 'Sign up' }));
    await waitFor(() => expect(location()).toBe('/trips'));
    expect(calls.find((c) => c.path === '/auth/signup')?.body).toEqual({
      name: 'Asha Rao',
      email: 'asha@example.com',
      password: 'shortenough',
    });
  });

  it('logs out from the nav bar', async () => {
    const { calls } = mockApi({
      ...loggedIn,
      'GET /trips': { body: { trips: [] } },
      'POST /auth/logout': { status: 204 },
    });
    const { user } = renderApp('/trips');
    await user.click(await screen.findByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(location()).toBe('/'));
    expect(calls.some((c) => c.path === '/auth/logout')).toBe(true);
  });
});
