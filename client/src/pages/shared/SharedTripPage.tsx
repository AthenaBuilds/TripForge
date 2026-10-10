import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ApiRequestError } from '../../api/client';
import { queryKeys, sharedApi } from '../../api/endpoints';
import { errorMessage } from '../../api/messages';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ExportButton } from '../../components/ExportButton';
import { ItineraryItemList } from '../../components/itinerary/ItineraryItemList';
import { toListItem } from '../../components/itinerary/types';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { TripHeader } from '../TripHeader';

/** /shared/:slug: public, read-only. No session needed and no 401 redirect. */
export default function SharedTripPage() {
  const { slug = '' } = useParams();
  const query = useQuery({ queryKey: queryKeys.shared(slug), queryFn: () => sharedApi.get(slug) });
  const items = useMemo(
    () => (query.data?.items ?? []).map((item, i) => toListItem(String(i), item)),
    [query.data],
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-heading text-xl font-bold text-sky-800">
            TripForge
          </Link>
          <span className="text-sm text-slate-500">Read-only itinerary</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:py-8">
        {query.isPending && <LoadingSpinner label="Loading itinerary" />}
        {query.isError &&
          (query.error instanceof ApiRequestError && query.error.status === 404 ? (
            <EmptyState title="This trip link is no longer available.">
              The owner may have stopped sharing it or created a new link.
            </EmptyState>
          ) : (
            <ErrorBanner>{errorMessage(query.error)}</ErrorBanner>
          ))}
        {query.isSuccess && (
          <>
            <TripHeader
              destination={query.data.destination}
              startDate={query.data.startDate}
              endDate={query.data.endDate}
            >
              <p className="text-sm text-slate-600">
                Planned by <span className="font-semibold">{query.data.ownerName}</span> · Last
                updated{' '}
                {new Date(query.data.updatedAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </TripHeader>
            <div className="card p-4">
              <ExportButton download={(format) => sharedApi.exportFile(slug, format)} />
            </div>
            {items.length === 0 ? (
              <EmptyState title="Nothing planned yet" />
            ) : (
              <ItineraryItemList trip={query.data} items={items} readOnly />
            )}
          </>
        )}
      </main>
    </div>
  );
}
