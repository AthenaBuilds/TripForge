import { Link } from 'react-router';
import { EmptyState } from '../components/EmptyState';

/** Placeholder for pages built in the next PR (itinerary builder, trip page, shared view). */
export default function ComingNext() {
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <EmptyState title="This page is coming in the next update">
        <Link to="/trips" className="font-semibold text-sky-700 underline">
          Back to your trips
        </Link>
      </EmptyState>
    </div>
  );
}
