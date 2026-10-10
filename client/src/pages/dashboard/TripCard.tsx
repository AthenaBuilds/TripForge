import { memo } from 'react';
import { Link } from 'react-router';
import type { TripSummary } from '@tripforge/shared';
import { formatDateRange, relativeHint } from '../../lib/dates';

type Props = { trip: TripSummary; today: string };

export const TripCard = memo(function TripCard({ trip, today }: Props) {
  const hint = relativeHint(trip.startDate, trip.endDate, today);
  return (
    <Link
      to={`/trips/${trip.id}`}
      className="card block transition hover:border-sky-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-sky-600"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900">{trip.destination}</h3>
        {trip.isShared && (
          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
            Shared
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-700">{formatDateRange(trip.startDate, trip.endDate)}</p>
      <p className="mt-2 flex flex-wrap gap-x-3 text-sm text-slate-500">
        <span className={hint === 'Ongoing' ? 'font-semibold text-sky-700' : undefined}>
          {hint}
        </span>
        <span>
          {trip.itemCount} {trip.itemCount === 1 ? 'item' : 'items'}
        </span>
      </p>
    </Link>
  );
});
