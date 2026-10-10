import type { TripSummary } from '@tripforge/shared';
import { TripCard } from './TripCard';

/**
 * Upcoming (endDate >= today, incl. ongoing; API order = soonest first) and
 * Past (endDate < today; most recent first). frontend-spec §4.
 */
export function splitTrips(trips: TripSummary[], today: string) {
  const upcoming = trips.filter((t) => t.endDate >= today);
  const past = trips.filter((t) => t.endDate < today).reverse();
  return { upcoming, past };
}

type Props = { trips: TripSummary[]; today: string };

export function TripList({ trips, today }: Props) {
  const { upcoming, past } = splitTrips(trips, today);
  return (
    <div className="space-y-8">
      {upcoming.length > 0 && <Section title="Upcoming" trips={upcoming} today={today} />}
      {past.length > 0 && <Section title="Past" trips={past} today={today} />}
    </div>
  );
}

function Section({ title, trips, today }: { title: string; trips: TripSummary[]; today: string }) {
  const headingId = `trips-${title.toLowerCase()}`;
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-3 text-lg font-semibold text-slate-800">
        {title}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {trips.map((trip) => (
          <li key={trip.id}>
            <TripCard trip={trip} today={today} />
          </li>
        ))}
      </ul>
    </section>
  );
}
