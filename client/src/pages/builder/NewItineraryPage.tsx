import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys, tripsApi } from '../../api/endpoints';
import { errorMessage } from '../../api/messages';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ExportButton } from '../../components/ExportButton';
import { ItineraryEditor } from '../../components/itinerary/ItineraryEditor';
import { toListItem, type ItemValues } from '../../components/itinerary/types';
import { useDraft } from '../../draft/DraftTripContext';
import { TripHeader } from '../TripHeader';

/** /trips/new/itinerary: builds a draft locally; nothing reaches the backend until Save Trip. */
export default function NewItineraryPage() {
  const { draft, updateDraft, clearDraft } = useDraft();
  const queryClient = useQueryClient();
  const [saveError, setSaveError] = useState<string | null>(null);
  // Set together with clearDraft so the "no draft" redirect below goes to the saved trip.
  const [savedTripId, setSavedTripId] = useState<string | null>(null);

  const items = useMemo(
    () => (draft?.items ?? []).map((i) => toListItem(i.clientId, i)),
    [draft?.items],
  );

  const save = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error('No draft');
      return tripsApi.create({
        destination: draft.destination,
        startDate: draft.startDate,
        endDate: draft.endDate,
        items: draft.items.map(({ clientId: _clientId, ...item }) => item),
      });
    },
    onSuccess: (trip) => {
      queryClient.setQueryData(queryKeys.trip(trip.id), trip);
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips, exact: true });
      setSavedTripId(trip.id);
      clearDraft();
    },
    onError: (err) => setSaveError(errorMessage(err)),
  });

  // After Save Trip: open the saved trip. Reloading with no draft: back to the dashboard.
  if (!draft) return <Navigate to={savedTripId ? `/trips/${savedTripId}` : '/trips'} replace />;

  const addItem = (values: ItemValues) =>
    updateDraft((d) => ({
      ...d,
      items: [...d.items, { clientId: crypto.randomUUID(), ...values }],
    }));
  const updateItem = (key: string, values: ItemValues) =>
    updateDraft((d) => ({
      ...d,
      items: d.items.map((i) => (i.clientId === key ? { clientId: key, ...values } : i)),
    }));
  const removeItem = (key: string) =>
    updateDraft((d) => ({ ...d, items: d.items.filter((i) => i.clientId !== key) }));

  return (
    <div className="space-y-6">
      <Link to="/trips" className="text-sm font-semibold text-sky-700 hover:underline">
        ← Your trips
      </Link>
      <TripHeader
        destination={draft.destination}
        startDate={draft.startDate}
        endDate={draft.endDate}
        badge={
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
            Draft · not saved
          </span>
        }
      />

      <div className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className="btn-primary"
            disabled={save.isPending}
            onClick={() => {
              setSaveError(null);
              save.mutate();
            }}
          >
            {save.isPending ? 'Saving…' : 'Save Trip'}
          </button>
          <span className="text-xs text-slate-500">
            {draft.items.length} {draft.items.length === 1 ? 'item' : 'items'} · auto-saved on this
            device
          </span>
        </div>
        <ExportButton />
      </div>
      {saveError && <ErrorBanner onDismiss={() => setSaveError(null)}>{saveError}</ErrorBanner>}

      <ItineraryEditor
        trip={draft}
        items={items}
        onAdd={addItem}
        onUpdate={updateItem}
        onRemove={removeItem}
      />
    </div>
  );
}
