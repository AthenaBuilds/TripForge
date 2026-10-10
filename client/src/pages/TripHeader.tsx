import type { ReactNode } from 'react';
import { formatDateRange } from '../lib/dates';

type Props = {
  destination: string;
  startDate: string;
  endDate: string;
  children?: ReactNode;
  badge?: ReactNode;
};

export function TripHeader({ destination, startDate, endDate, children, badge }: Props) {
  return (
    <header className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold break-words sm:text-3xl">{destination}</h1>
        {badge}
      </div>
      <p className="text-slate-600">{formatDateRange(startDate, endDate)}</p>
      {children}
    </header>
  );
}
