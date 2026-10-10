import { useMemo, type ReactNode } from 'react';
import { eachDate } from '@tripforge/shared';
import { formatDay } from '../../lib/dates';
import { ItineraryItemCard } from './ItineraryItemCard';
import { distinctCities, sortItems, type ListItem } from './types';

type Props = {
  trip: { startDate: string; endDate: string };
  items: ListItem[];
  readOnly?: boolean;
  highlightedKeys?: ReadonlySet<string>;
  onEdit?: (item: ListItem) => void;
  onRemove?: (item: ListItem) => void;
  /** Renders in place of the card being edited. */
  editingKey?: string | null;
  renderEditor?: (item: ListItem) => ReactNode;
};

/**
 * Items grouped by day for every day of the trip. Items dated outside the trip (only possible
 * after a rejected date change) are listed under their own date at the end so they stay visible.
 */
export function ItineraryItemList({
  trip,
  items,
  readOnly = false,
  highlightedKeys,
  onEdit,
  onRemove,
  editingKey,
  renderEditor,
}: Props) {
  const days = useMemo(() => {
    const sorted = sortItems(items);
    const tripDays = eachDate(trip.startDate, trip.endDate);
    const extra = [...new Set(sorted.map((i) => i.date))].filter((d) => !tripDays.includes(d));
    return [...tripDays, ...extra].map((date, index) => ({
      date,
      dayNumber: index < tripDays.length ? index + 1 : null,
      items: sorted.filter((i) => i.date === date),
    }));
  }, [items, trip.startDate, trip.endDate]);

  return (
    <ol className="space-y-6">
      {days.map((day) => {
        const cities = distinctCities(day.items);
        const headingId = `day-${day.date}`;
        return (
          <li key={day.date} aria-labelledby={headingId}>
            <h3
              id={headingId}
              className="mb-2 flex flex-wrap items-baseline gap-x-2 border-b border-slate-200 pb-1"
            >
              <span className="font-semibold text-slate-900">
                {day.dayNumber ? `Day ${day.dayNumber} · ` : ''}
                {formatDay(day.date)}
              </span>
              {cities.length > 0 && (
                <span className="text-sm font-normal text-slate-600">
                  <span className="sr-only">, </span>
                  {cities.join(' → ')}
                </span>
              )}
            </h3>
            {day.items.length === 0 ? (
              <p className="text-sm text-slate-500 italic">Nothing planned</p>
            ) : (
              <ul className="space-y-2">
                {day.items.map((item) => (
                  <li key={item.key}>
                    {editingKey === item.key && renderEditor ? (
                      <div className="card">{renderEditor(item)}</div>
                    ) : (
                      <ItineraryItemCard
                        item={item}
                        readOnly={readOnly}
                        highlighted={highlightedKeys?.has(item.key)}
                        onEdit={onEdit}
                        onRemove={onRemove}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
