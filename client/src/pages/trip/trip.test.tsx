import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ItineraryItem, TripDetail } from '@tripforge/shared';
import { loggedIn, mockApi, renderApp, type Routes } from '../../test/render';

const location = () => screen.getByTestId('location').textContent;
const tripId = '33333333-3333-4333-8333-333333333333';

function item(id: string, overrides: Partial<ItineraryItem>): ItineraryItem {
  return {
    id,
    tripId,
    title: 'Item',
    date: '2026-12-20',
    startTime: null,
    endTime: null,
    city: null,
    location: null,
    notes: null,
    createdAt: `2026-10-0${id.slice(-1)}T00:00:00.000Z`,
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

let trip: TripDetail;
beforeEach(() => {
  trip = {
    id: tripId,
    destination: 'Goa',
    startDate: '2026-12-20',
    endDate: '2026-12-24',
    shareSlug: null,
    sharedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    items: [
      item('i1', { title: 'Check in', date: '2026-12-20', startTime: '14:00', city: 'Panaji' }),
      item('i2', { title: 'Beach day', date: '2026-12-24', city: 'Candolim' }),
    ],
  };
});

/** A stateful fake backend for one trip. */
function tripRoutes(extra: Routes = {}): Routes {
  return {
    ...loggedIn,
    'GET /trips': { body: { trips: [] } },
    [`GET /trips/${tripId}`]: () => ({ body: { trip } }),
    ...extra,
  };
}

describe('/trips/:tripId', () => {
  it('shows the trip and its items; Export is enabled', async () => {
    mockApi(tripRoutes());
    renderApp(`/trips/${tripId}`);
    expect(await screen.findByRole('heading', { name: 'Goa', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Check in' })).toHaveTextContent('Panaji');
    expect(screen.getByRole('button', { name: 'PDF' })).toBeEnabled();
  });

  it('shows "Trip not found" for a 404', async () => {
    mockApi({
      ...loggedIn,
      [`GET /trips/${tripId}`]: {
        status: 404,
        body: { code: 'NOT_FOUND', message: 'Trip not found' },
      },
    });
    renderApp(`/trips/${tripId}`);
    expect(await screen.findByText('Trip not found')).toBeInTheDocument();
  });

  it('adds an item via the API, with City defaulting to the most recently added item', async () => {
    const { calls } = mockApi(
      tripRoutes({
        [`POST /trips/${tripId}/items`]: (body) => {
          const created = item('i3', { ...(body as object) });
          trip = { ...trip, items: [...trip.items, created] };
          return { status: 201, body: { item: created } };
        },
      }),
    );
    const { user } = renderApp(`/trips/${tripId}`);
    const form = await screen.findByRole('form', { name: 'Add item' });
    expect(within(form).getByLabelText(/^City/)).toHaveValue('Candolim');

    await user.type(within(form).getByLabelText('Activity'), 'Sunset cruise');
    await user.click(within(form).getByRole('button', { name: 'Add item' }));

    expect(await screen.findByRole('article', { name: 'Sunset cruise' })).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST' && c.path.endsWith('/items'))?.body).toMatchObject(
      {
        title: 'Sunset cruise',
        date: '2026-12-24',
        city: 'Candolim',
      },
    );
  });

  it('shows a server rejection in the add form and keeps the typed values', async () => {
    mockApi(
      tripRoutes({
        [`POST /trips/${tripId}/items`]: {
          status: 422,
          body: { code: 'ITEM_LIMIT_REACHED', message: 'A trip can have at most 200 items' },
        },
      }),
    );
    const { user } = renderApp(`/trips/${tripId}`);
    const form = await screen.findByRole('form', { name: 'Add item' });
    await user.type(within(form).getByLabelText('Activity'), 'One too many');
    await user.click(within(form).getByRole('button', { name: 'Add item' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('at most 200 items');
    expect(within(form).getByLabelText('Activity')).toHaveValue('One too many');
  });

  it('asks whether to move items when the start date moves, then sends shiftItems', async () => {
    const { calls } = mockApi(
      tripRoutes({
        [`PATCH /trips/${tripId}`]: (body) => {
          trip = { ...trip, ...(body as object) };
          return { body: { trip } };
        },
      }),
    );
    const { user } = renderApp(`/trips/${tripId}`);
    await user.click(await screen.findByRole('button', { name: 'Edit trip details' }));
    await user.clear(screen.getByLabelText('From Date'));
    await user.type(screen.getByLabelText('From Date'), '2026-12-22');
    await user.clear(screen.getByLabelText('To Date'));
    await user.type(screen.getByLabelText('To Date'), '2026-12-26');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    const dialog = screen.getByRole('dialog', {
      name: 'Move all items with the trip (by 2 days)?',
    });
    expect(dialog).toHaveTextContent('2 days later');
    await user.click(within(dialog).getByRole('button', { name: 'Move items' }));

    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({
        destination: 'Goa',
        startDate: '2026-12-22',
        endDate: '2026-12-26',
        shiftItems: true,
      }),
    );
    expect(await screen.findByRole('heading', { name: 'Goa', level: 1 })).toBeInTheDocument();
  });

  it('does not ask when only the destination or end date changes', async () => {
    const { calls } = mockApi(
      tripRoutes({
        [`PATCH /trips/${tripId}`]: (body) => ({
          body: { trip: { ...trip, ...(body as object) } },
        }),
      }),
    );
    const { user } = renderApp(`/trips/${tripId}`);
    await user.click(await screen.findByRole('button', { name: 'Edit trip details' }));
    await user.clear(screen.getByLabelText('Destination'));
    await user.type(screen.getByLabelText('Destination'), 'North Goa');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PATCH')?.body).toMatchObject({ shiftItems: false }),
    );
  });

  it('highlights the items listed in ITEMS_OUT_OF_RANGE', async () => {
    mockApi(
      tripRoutes({
        [`PATCH /trips/${tripId}`]: {
          status: 422,
          body: {
            code: 'ITEMS_OUT_OF_RANGE',
            message: 'Some items fall outside the new trip dates',
            details: [
              { field: 'items', message: '1 item falls outside the new dates', itemIds: ['i2'] },
            ],
          },
        },
      }),
    );
    const { user } = renderApp(`/trips/${tripId}`);
    await user.click(await screen.findByRole('button', { name: 'Edit trip details' }));
    await user.clear(screen.getByLabelText('To Date'));
    await user.type(screen.getByLabelText('To Date'), '2026-12-23');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText(/1 item falls outside the new dates/)).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Beach day' })).toHaveAttribute(
      'data-highlighted',
      'true',
    );
    expect(screen.getByRole('article', { name: 'Check in' })).not.toHaveAttribute(
      'data-highlighted',
    );
  });

  it('deletes the trip after confirmation and returns to the dashboard', async () => {
    const { calls } = mockApi(tripRoutes({ [`DELETE /trips/${tripId}`]: { status: 204 } }));
    const { user } = renderApp(`/trips/${tripId}`);
    await user.click(await screen.findByRole('button', { name: 'Delete Trip' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete this trip?' });
    expect(dialog).toHaveTextContent('2 items');
    await user.click(within(dialog).getByRole('button', { name: 'Delete Trip' }));

    await waitFor(() => expect(location()).toBe('/trips'));
    expect(calls.some((c) => c.method === 'DELETE' && c.path === `/trips/${tripId}`)).toBe(true);
  });

  it('downloads an export through an object URL', async () => {
    const createObjectURL = vi.fn(() => 'blob:fake');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { fetchMock } = mockApi(tripRoutes());
    const real = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) =>
      String(input).includes('/export')
        ? new Response(new Blob(['%PDF-']), {
            headers: {
              'Content-Disposition': 'attachment; filename="tripforge-goa-2026-12-20.pdf"',
            },
          })
        : real(input, init),
    );

    const { user } = renderApp(`/trips/${tripId}`);
    await user.click(await screen.findByRole('button', { name: 'PDF' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/trips/${tripId}/export?format=pdf`,
      expect.anything(),
    );
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe(
      'tripforge-goa-2026-12-20.pdf',
    );
    click.mockRestore();
  });
});

describe('ShareTripPanel', () => {
  it('shares, copies the link, and stops sharing after confirmation', async () => {
    const { calls } = mockApi(
      tripRoutes({
        [`POST /trips/${tripId}/share`]: () => {
          trip = {
            ...trip,
            shareSlug: 'abcDEF123_-abcDEF123_',
            sharedAt: '2026-10-10T00:00:00.000Z',
          };
          return { status: 201, body: { shareSlug: trip.shareSlug, sharedAt: trip.sharedAt } };
        },
        [`DELETE /trips/${tripId}/share`]: () => {
          trip = { ...trip, shareSlug: null, sharedAt: null };
          return { status: 204 };
        },
      }),
    );
    const { user } = renderApp(`/trips/${tripId}`);
    // After renderApp: userEvent.setup() installs its own clipboard stub.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await user.click(await screen.findByRole('button', { name: 'Share' }));

    const link = await screen.findByLabelText('Read-only link');
    expect(link).toHaveValue(`${window.location.origin}/shared/abcDEF123_-abcDEF123_`);
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/shared/abcDEF123_-abcDEF123_`,
    );
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Stop sharing' }));
    const dialog = screen.getByRole('dialog', { name: 'Stop sharing this trip?' });
    await user.click(within(dialog).getByRole('button', { name: 'Stop sharing' }));
    expect(await screen.findByRole('button', { name: 'Share' })).toBeInTheDocument();
    expect(calls.filter((c) => c.path === `/trips/${tripId}/share`).map((c) => c.method)).toEqual([
      'POST',
      'DELETE',
    ]);
  });
});
