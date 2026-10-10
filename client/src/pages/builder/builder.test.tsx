import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { draftKey, loadDraft } from '../../draft/draftStorage';
import { loggedIn, mockApi, renderApp, testUser } from '../../test/render';

const location = () => screen.getByTestId('location').textContent;

function storeDraft(items: unknown[] = []) {
  localStorage.setItem(
    draftKey(testUser.id),
    JSON.stringify({
      version: 1,
      destination: 'South India',
      startDate: '2026-12-20',
      endDate: '2026-12-22',
      items,
      updatedAt: '2026-10-01T00:00:00.000Z',
    }),
  );
}

describe('/trips/new/itinerary', () => {
  it('redirects to /trips without a draft', async () => {
    mockApi({ ...loggedIn, 'GET /trips': { body: { trips: [] } } });
    renderApp('/trips/new/itinerary');
    await waitFor(() => expect(location()).toBe('/trips'));
  });

  it('restores the draft on reload, every day listed, Export disabled until saved', async () => {
    storeDraft([{ clientId: 'a', title: 'Lalbagh', date: '2026-12-21', city: 'Bengaluru' }]);
    mockApi(loggedIn);
    renderApp('/trips/new/itinerary');

    expect(
      await screen.findByRole('heading', { name: 'South India', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Draft · not saved')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Lalbagh' })).toBeInTheDocument();
    expect(screen.getAllByText('Nothing planned')).toHaveLength(2); // days 1 and 3

    for (const name of ['PDF', 'Excel']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
    expect(screen.getByText('Save the trip to export')).toBeInTheDocument();
  });

  it('adds items one by one, pre-filling the date and city from the last item', async () => {
    storeDraft();
    mockApi(loggedIn);
    const { user } = renderApp('/trips/new/itinerary');
    const form = await screen.findByRole('form', { name: 'Add item' });
    const field = (label: string) => within(form).getByLabelText(new RegExp(`^${label}`));

    await user.click(within(form).getByRole('button', { name: 'Add item' }));
    expect(within(form).getByText('Enter an activity.')).toBeInTheDocument();

    await user.type(field('Activity'), 'Mysore Palace');
    await user.clear(field('Date'));
    await user.type(field('Date'), '2026-12-22');
    await user.type(field('Start time'), '19:00');
    await user.type(field('End time'), '18:00');
    await user.type(field('City'), 'Mysuru');
    await user.click(within(form).getByRole('button', { name: 'Add item' }));
    expect(
      within(form).getByText('The end time must be at or after the start time.'),
    ).toBeInTheDocument();

    await user.clear(field('End time'));
    await user.type(field('End time'), '20:00');
    await user.click(within(form).getByRole('button', { name: 'Add item' }));

    expect(await screen.findByRole('article', { name: 'Mysore Palace' })).toHaveTextContent(
      '19:00–20:00',
    );
    // Day header lists the day's cities.
    expect(screen.getByRole('heading', { name: /^Day 3 .*Mysuru$/ })).toBeInTheDocument();
    // Form reset for the next item, keeping date and city.
    expect(field('Activity')).toHaveValue('');
    expect(field('Date')).toHaveValue('2026-12-22');
    expect(field('City')).toHaveValue('Mysuru');

    await waitFor(() =>
      expect(loadDraft(testUser.id)?.items).toMatchObject([
        {
          title: 'Mysore Palace',
          date: '2026-12-22',
          startTime: '19:00',
          endTime: '20:00',
          city: 'Mysuru',
        },
      ]),
    );
  });

  it('edits and removes (with confirmation) a draft item', async () => {
    storeDraft([{ clientId: 'a', title: 'Lalbagh', date: '2026-12-21' }]);
    mockApi(loggedIn);
    const { user } = renderApp('/trips/new/itinerary');

    await user.click(await screen.findByRole('button', { name: 'Edit Lalbagh' }));
    const edit = screen.getByRole('form', { name: 'Edit item' });
    await user.clear(within(edit).getByLabelText('Activity'));
    await user.type(within(edit).getByLabelText('Activity'), 'Lalbagh Garden');
    await user.click(within(edit).getByRole('button', { name: 'Save item' }));
    expect(await screen.findByRole('article', { name: 'Lalbagh Garden' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove Lalbagh Garden' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove this item?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(screen.queryByRole('article', { name: 'Lalbagh Garden' })).not.toBeInTheDocument();
    expect(screen.getByText('No items yet')).toBeInTheDocument();
  });

  it('Save Trip posts the trip with its items, clears the draft, and opens the trip', async () => {
    storeDraft([
      {
        clientId: 'a',
        title: 'Lalbagh',
        date: '2026-12-21',
        startTime: '10:00',
        city: 'Bengaluru',
      },
    ]);
    const tripId = '22222222-2222-4222-8222-222222222222';
    const saved = {
      id: tripId,
      destination: 'South India',
      startDate: '2026-12-20',
      endDate: '2026-12-22',
      shareSlug: null,
      sharedAt: null,
      createdAt: '2026-10-10T00:00:00.000Z',
      updatedAt: '2026-10-10T00:00:00.000Z',
      items: [],
    };
    const { calls } = mockApi({
      ...loggedIn,
      'POST /trips': { status: 201, body: { trip: saved } },
      [`GET /trips/${tripId}`]: { body: { trip: saved } },
    });
    const { user } = renderApp('/trips/new/itinerary');
    await user.click(await screen.findByRole('button', { name: 'Save Trip' }));

    await waitFor(() => expect(location()).toBe(`/trips/${tripId}`));
    expect(calls.find((c) => c.method === 'POST' && c.path === '/trips')?.body).toEqual({
      destination: 'South India',
      startDate: '2026-12-20',
      endDate: '2026-12-22',
      items: [{ title: 'Lalbagh', date: '2026-12-21', startTime: '10:00', city: 'Bengaluru' }],
    });
    expect(localStorage.getItem(draftKey(testUser.id))).toBeNull();
  });

  it('keeps the draft and shows the error when saving fails', async () => {
    storeDraft();
    mockApi({
      ...loggedIn,
      'POST /trips': {
        status: 422,
        body: { code: 'DATE_RANGE_INVALID', message: 'A trip can last at most 60 days' },
      },
    });
    const { user } = renderApp('/trips/new/itinerary');
    await user.click(await screen.findByRole('button', { name: 'Save Trip' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A trip can last at most 60 days');
    expect(location()).toBe('/trips/new/itinerary');
    expect(loadDraft(testUser.id)).not.toBeNull();
  });
});
