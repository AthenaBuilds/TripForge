import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { loggedOut, mockApi, renderApp } from '../../test/render';

const sharedTrip = {
  destination: 'South India',
  startDate: '2026-12-20',
  endDate: '2026-12-21',
  ownerName: 'Asha Rao',
  updatedAt: '2026-10-03T10:15:00.000Z',
  items: [
    {
      title: 'Lalbagh Botanical Garden',
      date: '2026-12-21',
      startTime: '10:00',
      endTime: '12:00',
      city: 'Bengaluru',
      location: 'Lalbagh',
      notes: null,
    },
  ],
};

describe('/shared/:slug', () => {
  it('shows the read-only itinerary to a logged-out viewer', async () => {
    mockApi({ ...loggedOut, 'GET /shared/slug123': { body: { trip: sharedTrip } } });
    renderApp('/shared/slug123');

    expect(
      await screen.findByRole('heading', { name: 'South India', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Lalbagh Botanical Garden' })).toHaveTextContent(
      '10:00–12:00',
    );
    expect(screen.queryByRole('button', { name: /Edit|Remove/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PDF' })).toBeEnabled();
    expect(screen.getByTestId('location').textContent).toBe('/shared/slug123');
  });

  it('shows the "no longer available" message for an unknown or revoked link', async () => {
    mockApi({
      ...loggedOut,
      'GET /shared/gone': {
        status: 404,
        body: { code: 'NOT_FOUND', message: 'Shared trip not found' },
      },
    });
    renderApp('/shared/gone');
    expect(await screen.findByText('This trip link is no longer available.')).toBeInTheDocument();
  });
});
