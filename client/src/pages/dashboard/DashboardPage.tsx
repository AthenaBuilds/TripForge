import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { queryKeys, tripsApi } from '../../api/endpoints';
import { errorMessage } from '../../api/messages';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useDraft, type DraftDetails } from '../../draft/DraftTripContext';
import { formatDateRange, todayLocal } from '../../lib/dates';
import { NewTripDetailsForm } from './NewTripDetailsForm';
import { TripList } from './TripList';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { draft, startDraft, clearDraft } = useDraft();
  const [pending, setPending] = useState<DraftDetails | null>(null);
  const trips = useQuery({ queryKey: queryKeys.trips, queryFn: tripsApi.list });
  const today = todayLocal();

  function begin(details: DraftDetails) {
    startDraft(details);
    navigate('/trips/new/itinerary');
  }

  function handleAddTrip(details: DraftDetails) {
    // One draft per user: ask before replacing an existing one.
    if (draft) setPending(details);
    else begin(details);
  }

  return (
    <div className="space-y-8">
      {draft && (
        <div
          role="region"
          aria-label="Unsaved draft"
          className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-amber-900">
            <span className="font-semibold">Resume draft: {draft.destination}</span>
            <span className="block text-amber-800 sm:inline sm:before:content-['_·_']">
              {formatDateRange(draft.startDate, draft.endDate)} · {draft.items.length}{' '}
              {draft.items.length === 1 ? 'item' : 'items'} · not saved yet
            </span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate('/trips/new/itinerary')}
            >
              Resume
            </button>
            <button type="button" className="btn-secondary" onClick={clearDraft}>
              Discard
            </button>
          </div>
        </div>
      )}

      <section aria-labelledby="new-trip-heading" className="card p-5">
        <h1 id="new-trip-heading" className="mb-4 text-2xl font-bold">
          Plan a new trip
        </h1>
        <NewTripDetailsForm onSubmit={handleAddTrip} />
      </section>

      <section aria-label="Your trips">
        {trips.isPending && <LoadingSpinner label="Loading your trips" />}
        {trips.isError && <ErrorBanner>{errorMessage(trips.error)}</ErrorBanner>}
        {trips.isSuccess &&
          (trips.data.length === 0 ? (
            <EmptyState title="No trips so far">
              Enter a destination and dates above, then press <strong>Add Trip</strong> to start
              planning.
            </EmptyState>
          ) : (
            <TripList trips={trips.data} today={today} />
          ))}
      </section>

      {pending && draft && (
        <ConfirmDialog
          title="Resume draft or start over?"
          onCancel={() => setPending(null)}
          actions={[
            {
              label: 'Resume draft',
              variant: 'secondary',
              onClick: () => navigate('/trips/new/itinerary'),
            },
            { label: 'Start over', variant: 'danger', onClick: () => begin(pending) },
          ]}
        >
          You have an unsaved draft for <strong>{draft.destination}</strong> with{' '}
          {draft.items.length} {draft.items.length === 1 ? 'item' : 'items'}. Starting over discards
          it.
        </ConfirmDialog>
      )}
    </div>
  );
}
