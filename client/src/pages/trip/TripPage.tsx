import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useBlocker, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { daysBetween, type TripDetail } from '@tripforge/shared';
import { ApiRequestError } from '../../api/client';
import { queryKeys, tripsApi } from '../../api/endpoints';
import { errorMessage } from '../../api/messages';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ExportButton } from '../../components/ExportButton';
import { ItineraryEditor } from '../../components/itinerary/ItineraryEditor';
import { toListItem } from '../../components/itinerary/types';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import type { DraftDetails } from '../../draft/DraftTripContext';
import { NewTripDetailsForm } from '../dashboard/NewTripDetailsForm';
import { TripHeader } from '../TripHeader';
import { ShareTripPanel } from './ShareTripPanel';
import { UpdateTripBar } from './UpdateTripBar';
import { usePendingItems } from './usePendingItems';

export default function TripPage() {
  const { tripId = '' } = useParams();
  const query = useQuery({ queryKey: queryKeys.trip(tripId), queryFn: () => tripsApi.get(tripId) });

  if (query.isPending) return <LoadingSpinner label="Loading trip" />;
  if (query.isError) {
    const missing =
      query.error instanceof ApiRequestError && [400, 404].includes(query.error.status);
    return missing ? (
      <EmptyState title="Trip not found">
        It may have been deleted.{' '}
        <Link to="/trips" className="font-semibold text-sky-700 underline">
          Back to your trips
        </Link>
      </EmptyState>
    ) : (
      <ErrorBanner>{errorMessage(query.error)}</ErrorBanner>
    );
  }
  return <TripView trip={query.data} />;
}

type DateChange = { details: DraftDetails; offset: number };

function TripView({ trip }: { trip: TripDetail }) {
  const queryClient = useQueryClient();
  const [editingDetails, setEditingDetails] = useState(false);
  const [dateChange, setDateChange] = useState<DateChange | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [outOfRange, setOutOfRange] = useState<ReadonlySet<string>>(new Set());
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Saved items in insertion order, so the City default comes from the most recently added item.
  const savedItems = useMemo(
    () =>
      [...trip.items]
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((i) => toListItem(i.id, i)),
    [trip.items],
  );
  const pending = usePendingItems(savedItems);

  const deleteTrip = useMutation({
    mutationFn: () => tripsApi.remove(trip.id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.trip(trip.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips, exact: true });
    },
  });

  // Ask before leaving with unsaved item changes: in-app navigation...
  const blocker = useBlocker(pending.isDirty && !deleteTrip.isSuccess);
  // ...and reload / closing the tab.
  useEffect(() => {
    if (!pending.isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [pending.isDirty]);

  const saved = (updated: TripDetail) => {
    queryClient.setQueryData(queryKeys.trip(trip.id), updated);
    void queryClient.invalidateQueries({ queryKey: queryKeys.trips, exact: true });
  };

  const updateItems = useMutation({
    mutationFn: () => tripsApi.replaceItems(trip.id, pending.toRequest()),
    onMutate: () => setUpdateError(null),
    onSuccess: (updated) => {
      saved(updated);
      pending.reset();
      setOutOfRange(new Set());
    },
    onError: (err) => {
      // "items[3]: ..." -> the item's title, since the user never sees indexes.
      const message = errorMessage(err).replace(/^items\[(\d+)\]/, (match, i: string) => {
        const item = pending.items[Number(i)];
        return item ? `"${item.title}"` : match;
      });
      setUpdateError(message);
    },
  });

  const updateTrip = useMutation({
    mutationFn: (input: DraftDetails & { shiftItems: boolean }) => tripsApi.update(trip.id, input),
    onSuccess: (updated) => {
      saved(updated);
      setEditingDetails(false);
      setOutOfRange(new Set());
      setDetailsError(null);
    },
    onError: (err) => {
      if (err instanceof ApiRequestError && err.code === 'ITEMS_OUT_OF_RANGE') {
        const ids = err.details.flatMap((d) =>
          Array.isArray(d.itemIds) ? (d.itemIds as string[]) : [],
        );
        setOutOfRange(new Set(ids));
        const n = ids.length;
        setDetailsError(
          `${n} ${n === 1 ? 'item falls' : 'items fall'} outside the new dates. Edit or remove the highlighted ${n === 1 ? 'item' : 'items'}, click Update Trip, then change the dates again.`,
        );
      } else {
        setDetailsError(errorMessage(err));
      }
    },
  });

  function handleDetails(details: DraftDetails) {
    setDetailsError(null);
    const offset = daysBetween(trip.startDate, details.startDate);
    // Start date moved and there are items: ask whether they move too (frontend-spec §5).
    if (offset !== 0 && trip.items.length > 0) setDateChange({ details, offset });
    else updateTrip.mutate({ ...details, shiftItems: false });
  }

  if (deleteTrip.isSuccess) return <Navigate to="/trips" replace />;

  const days = dateChange ? Math.abs(dateChange.offset) : 0;

  return (
    <div className="space-y-6">
      <Link to="/trips" className="text-sm font-semibold text-sky-700 hover:underline">
        ← Your trips
      </Link>

      {editingDetails ? (
        <section aria-labelledby="edit-details-heading" className="card p-5">
          <h1 id="edit-details-heading" className="mb-4 text-xl font-semibold">
            Edit trip details
          </h1>
          <NewTripDetailsForm
            initial={{
              destination: trip.destination,
              startDate: trip.startDate,
              endDate: trip.endDate,
            }}
            savedStartDate={trip.startDate}
            submitLabel={updateTrip.isPending ? 'Saving…' : 'Save changes'}
            onSubmit={handleDetails}
          />
          <button
            type="button"
            className="btn-secondary mt-3"
            onClick={() => {
              setEditingDetails(false);
              setDetailsError(null);
            }}
          >
            Cancel
          </button>
        </section>
      ) : (
        <TripHeader
          destination={trip.destination}
          startDate={trip.startDate}
          endDate={trip.endDate}
          badge={
            trip.shareSlug && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                Shared
              </span>
            )
          }
        >
          <div className="flex flex-wrap items-center gap-x-3">
            <button
              type="button"
              className="text-sm font-semibold text-sky-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
              disabled={pending.isDirty}
              aria-describedby={pending.isDirty ? 'details-locked-hint' : undefined}
              onClick={() => setEditingDetails(true)}
            >
              Edit trip details
            </button>
            {pending.isDirty && (
              <span id="details-locked-hint" className="text-xs text-slate-500">
                Update or discard your item changes first
              </span>
            )}
          </div>
        </TripHeader>
      )}
      {detailsError && (
        <ErrorBanner onDismiss={() => setDetailsError(null)}>{detailsError}</ErrorBanner>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-2 p-4">
          <ExportButton download={(format) => tripsApi.exportFile(trip.id, format)} />
          {pending.isDirty && (
            <p className="text-xs text-slate-500">Exports use the last saved version.</p>
          )}
        </div>
        <ShareTripPanel trip={trip} />
      </div>

      <ItineraryEditor
        trip={trip}
        items={pending.items}
        highlightedKeys={outOfRange}
        statusByKey={pending.statusByKey}
        onAdd={pending.add}
        onUpdate={pending.update}
        onRemove={(key) => {
          pending.remove(key);
          setOutOfRange((s) => {
            const next = new Set(s);
            next.delete(key);
            return next;
          });
        }}
      />

      {pending.isDirty && (
        <UpdateTripBar
          summary={pending.summary}
          saving={updateItems.isPending}
          error={updateError}
          onUpdate={() => updateItems.mutate()}
          onDiscard={() => setConfirmDiscard(true)}
        />
      )}

      <section className="border-t border-slate-200 pt-6">
        <button type="button" className="btn-danger" onClick={() => setConfirmDelete(true)}>
          Delete Trip
        </button>
        {deleteTrip.isError && (
          <div className="mt-3">
            <ErrorBanner>{errorMessage(deleteTrip.error)}</ErrorBanner>
          </div>
        )}
      </section>

      {dateChange && (
        <ConfirmDialog
          title={`Move all items with the trip (by ${days} ${days === 1 ? 'day' : 'days'})?`}
          onCancel={() => setDateChange(null)}
          actions={[
            {
              label: 'Keep item dates',
              variant: 'secondary',
              onClick: () => {
                updateTrip.mutate({ ...dateChange.details, shiftItems: false });
                setDateChange(null);
              },
            },
            {
              label: 'Move items',
              onClick: () => {
                updateTrip.mutate({ ...dateChange.details, shiftItems: true });
                setDateChange(null);
              },
            },
          ]}
        >
          The trip now starts {days} {days === 1 ? 'day' : 'days'}{' '}
          {dateChange.offset > 0 ? 'later' : 'earlier'}. Move every item by the same amount, or keep
          each item on its current date?
        </ConfirmDialog>
      )}

      {confirmDiscard && (
        <ConfirmDialog
          title="Discard your changes?"
          onCancel={() => setConfirmDiscard(false)}
          actions={[
            {
              label: 'Discard changes',
              variant: 'danger',
              onClick: () => {
                pending.reset();
                setUpdateError(null);
                setConfirmDiscard(false);
              },
            },
          ]}
        >
          The itinerary goes back to the last saved version.
        </ConfirmDialog>
      )}

      {blocker.state === 'blocked' && (
        <ConfirmDialog
          title="Leave without saving?"
          onCancel={() => blocker.reset()}
          actions={[
            { label: 'Leave without saving', variant: 'danger', onClick: () => blocker.proceed() },
          ]}
        >
          You have {pending.changeCount} unsaved {pending.changeCount === 1 ? 'change' : 'changes'}{' '}
          to this itinerary. Click <strong>Update Trip</strong> to keep them.
        </ConfirmDialog>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this trip?"
          onCancel={() => setConfirmDelete(false)}
          actions={[
            {
              label: deleteTrip.isPending ? 'Deleting…' : 'Delete Trip',
              variant: 'danger',
              onClick: () => {
                setConfirmDelete(false);
                deleteTrip.mutate();
              },
            },
          ]}
        >
          <strong>{trip.destination}</strong> and its {trip.items.length}{' '}
          {trip.items.length === 1 ? 'item' : 'items'} will be permanently deleted. Any share link
          stops working.
        </ConfirmDialog>
      )}
    </div>
  );
}
