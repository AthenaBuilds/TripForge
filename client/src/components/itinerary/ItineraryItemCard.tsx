import { memo } from 'react';
import type { ListItem } from './types';

type Props = {
  item: ListItem;
  readOnly?: boolean;
  highlighted?: boolean;
  /** Unsaved change on /trips/:tripId (shown until Update Trip). */
  status?: 'new' | 'edited';
  onEdit?: (item: ListItem) => void;
  onRemove?: (item: ListItem) => void;
};

function timeLabel(item: ListItem): string | null {
  if (item.startTime && item.endTime) return `${item.startTime}–${item.endTime}`;
  if (item.startTime) return item.startTime;
  if (item.endTime) return `until ${item.endTime}`;
  return null;
}

export const ItineraryItemCard = memo(function ItineraryItemCard({
  item,
  readOnly = false,
  highlighted = false,
  status,
  onEdit,
  onRemove,
}: Props) {
  const time = timeLabel(item);
  return (
    <article
      aria-label={item.title}
      data-highlighted={highlighted || undefined}
      data-status={status}
      className={`flex gap-3 rounded-lg border bg-white p-3 sm:gap-4 ${
        highlighted
          ? 'border-red-400 ring-2 ring-red-200'
          : status
            ? 'border-amber-300 bg-amber-50/40'
            : 'border-slate-200'
      }`}
    >
      <div className="w-20 shrink-0 pt-0.5 text-sm text-slate-500 tabular-nums sm:w-24">
        {time ?? <span aria-label="No time">—</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-semibold break-words text-slate-900">{item.title}</h4>
          {item.city && (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
              {item.city}
            </span>
          )}
          {status && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              {status === 'new' ? 'New' : 'Edited'} · not saved
            </span>
          )}
          {highlighted && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
              Outside new dates
            </span>
          )}
        </div>
        {item.location && <p className="mt-0.5 text-sm text-slate-600">{item.location}</p>}
        {item.notes && (
          <p className="mt-1 text-sm whitespace-pre-line text-slate-700">{item.notes}</p>
        )}
      </div>
      {!readOnly && (
        <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-start">
          <button
            type="button"
            className="rounded px-2 py-1 text-sm font-semibold text-sky-700 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-sky-600"
            onClick={() => onEdit?.(item)}
            aria-label={`Edit ${item.title}`}
          >
            Edit
          </button>
          <button
            type="button"
            className="rounded px-2 py-1 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600"
            onClick={() => onRemove?.(item)}
            aria-label={`Remove ${item.title}`}
          >
            Remove
          </button>
        </div>
      )}
    </article>
  );
});
