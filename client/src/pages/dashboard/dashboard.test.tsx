import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { draftKey, loadDraft } from '../../draft/draftStorage';
import { loggedIn, mockApi, renderApp, testUser, tripSummary } from '../../test/render';

const location = () => screen.getByTestId('location').textContent;

function storeDraft(destination = 'Kerala', items: unknown[] = []) {
  localStorage.setItem(
    draftKey(testUser.id),
    JSON.stringify({
      version: 1,
      destination,
      startDate: '2026-12-01',
      endDate: '2026-12-05',
      items,
      updatedAt: '2026-10-01T00:00:00.000Z',
    }),
  );
}

describe('NewTripDetailsForm', () => {
  it('shows inline errors for missing and invalid fields', async () => {
    mockApi({ ...loggedIn, 'GET /trips': { body: { trips: [] } } });
    const { user } = renderApp('/trips');
    const add = await screen.findByRole('button', { name: 'Add Trip' });

    await user.click(add);
    expect(screen.getByText('Enter a destination.')).toBeInTheDocument();
    expect(screen.getByText('Choose a start date.')).toBeInTheDocument();
    expect(screen.getByText('Choose an end date.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Destination'), 'Goa');
    await user.type(screen.getByLabelText('From Date'), '2026-12-20');
    await user.type(screen.getByLabelText('To Date'), '2026-12-19');
    await user.click(add);
    expect(
      screen.getByText('The end date must be on or after the start date.'),
    ).toBeInTheDocument();

    await user.clear(screen.getByLabelText('To Date'));
    await user.type(screen.getByLabelText('To Date'), '2027-02-28');
    await user.click(add);
    expect(screen.getByText('A trip can last at most 60 days.')).toBeInTheDocument();
    expect(location()).toBe('/trips');
  });

  it('starts a draft and opens the itinerary builder', async () => {
    mockApi({ ...loggedIn, 'GET /trips': { body: { trips: [] } } });
    const { user } = renderApp('/trips');
    await user.type(await screen.findByLabelText('Destination'), '  South India ');
    await user.type(screen.getByLabelText('From Date'), '2026-12-20');
    await user.type(screen.getByLabelText('To Date'), '2026-12-28');
    await user.click(screen.getByRole('button', { name: 'Add Trip' }));

    await waitFor(() => expect(location()).toBe('/trips/new/itinerary'));
    // Auto-saved after the debounce.
    await waitFor(() =>
      expect(loadDraft(testUser.id)).toMatchObject({
        version: 1,
        destination: 'South India',
        startDate: '2026-12-20',
        endDate: '2026-12-28',
        items: [],
      }),
    );
  });
});

describe('trip list', () => {
  it('shows the empty state when there are no trips', async () => {
    mockApi({ ...loggedIn, 'GET /trips': { body: { trips: [] } } });
    renderApp('/trips');
    expect(await screen.findByText('No trips so far')).toBeInTheDocument();
  });

  it('splits Upcoming (soonest first, incl. ongoing) and Past (most recent first)', async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 10, 12), shouldAdvanceTime: true });
    mockApi({
      ...loggedIn,
      'GET /trips': {
        body: {
          trips: [
            // API order: startDate ascending.
            tripSummary({ destination: 'Old', startDate: '2026-01-01', endDate: '2026-01-03' }),
            tripSummary({ destination: 'Recent', startDate: '2026-09-01', endDate: '2026-09-03' }),
            tripSummary({
              destination: 'Now',
              startDate: '2026-10-08',
              endDate: '2026-10-12',
              isShared: true,
              itemCount: 1,
            }),
            tripSummary({
              destination: 'Soon',
              startDate: '2026-12-27',
              endDate: '2026-12-29',
              itemCount: 4,
            }),
          ],
        },
      },
    });
    renderApp('/trips');

    const upcoming = await screen.findByRole('region', { name: 'Upcoming' });
    const past = screen.getByRole('region', { name: 'Past' });
    const names = (el: HTMLElement) =>
      within(el)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent);
    expect(names(upcoming)).toEqual(['Now', 'Soon']);
    expect(names(past)).toEqual(['Recent', 'Old']);

    const now = within(upcoming).getByRole('link', { name: /Now/ });
    expect(now).toHaveTextContent('Ongoing');
    expect(now).toHaveTextContent('Shared');
    expect(now).toHaveTextContent('1 item');
    expect(now).toHaveAttribute('href', expect.stringMatching(/^\/trips\/[0-9a-f-]{36}$/));
    expect(within(upcoming).getByRole('link', { name: /Soon/ })).toHaveTextContent('in 78 days');
  });

  it('hides an empty section', async () => {
    mockApi({
      ...loggedIn,
      'GET /trips': {
        body: { trips: [tripSummary({ startDate: '2099-01-01', endDate: '2099-01-02' })] },
      },
    });
    renderApp('/trips');
    expect(await screen.findByRole('region', { name: 'Upcoming' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Past' })).not.toBeInTheDocument();
  });

  it('shows an error banner when loading fails', async () => {
    mockApi({
      ...loggedIn,
      'GET /trips': { status: 500, body: { code: 'INTERNAL_ERROR', message: 'boom' } },
    });
    renderApp('/trips');
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong on our side');
  });
});

describe('draft banner', () => {
  it('offers Resume and Discard for a stored draft', async () => {
    storeDraft('Kerala', [{ clientId: 'a', title: 'Houseboat', date: '2026-12-02' }]);
    mockApi({ ...loggedIn, 'GET /trips': { body: { trips: [] } } });
    const { user } = renderApp('/trips');

    const banner = await screen.findByRole('region', { name: 'Unsaved draft' });
    expect(banner).toHaveTextContent('Resume draft: Kerala');
    expect(banner).toHaveTextContent('1 item');

    await user.click(within(banner).getByRole('button', { name: 'Discard' }));
    expect(screen.queryByRole('region', { name: 'Unsaved draft' })).not.toBeInTheDocument();
    expect(localStorage.getItem(draftKey(testUser.id))).toBeNull();
  });

  it('Resume opens the builder', async () => {
    storeDraft();
    mockApi({ ...loggedIn, 'GET /trips': { body: { trips: [] } } });
    const { user } = renderApp('/trips');
    await user.click(await screen.findByRole('button', { name: 'Resume' }));
    expect(location()).toBe('/trips/new/itinerary');
  });

  it('asks "Resume draft or start over?" when adding a trip with a draft', async () => {
    storeDraft('Kerala');
    mockApi({ ...loggedIn, 'GET /trips': { body: { trips: [] } } });
    const { user } = renderApp('/trips');
    await user.type(await screen.findByLabelText('Destination'), 'Goa');
    await user.type(screen.getByLabelText('From Date'), '2026-12-20');
    await user.type(screen.getByLabelText('To Date'), '2026-12-24');
    await user.click(screen.getByRole('button', { name: 'Add Trip' }));

    const dialog = screen.getByRole('dialog', { name: 'Resume draft or start over?' });
    expect(dialog).toHaveTextContent('Kerala');
    await user.click(within(dialog).getByRole('button', { name: 'Start over' }));

    expect(location()).toBe('/trips/new/itinerary');
    await waitFor(() => expect(loadDraft(testUser.id)?.destination).toBe('Goa'));
  });
});

describe('start date rule (today: 2026-10-10)', () => {
  it('rejects a From Date in the past and allows today', async () => {
    mockApi({ ...loggedIn, 'GET /trips': { body: { trips: [] } } });
    const { user } = renderApp('/trips');
    const from = await screen.findByLabelText('From Date');
    expect(from).toHaveAttribute('min', '2026-10-10');

    await user.type(screen.getByLabelText('Destination'), 'Goa');
    await user.type(from, '2026-10-09');
    await user.type(screen.getByLabelText('To Date'), '2026-10-12');
    await user.click(screen.getByRole('button', { name: 'Add Trip' }));
    expect(screen.getByText("The trip can't start in the past.")).toBeInTheDocument();

    await user.clear(from);
    await user.type(from, '2026-10-10');
    await user.click(screen.getByRole('button', { name: 'Add Trip' }));
    await waitFor(() => expect(location()).toBe('/trips/new/itinerary'));
  });
});
