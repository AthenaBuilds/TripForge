import { ErrorBanner } from '../../components/ErrorBanner';

type Props = {
  summary: { added: number; edited: number; removed: number };
  saving: boolean;
  error: string | null;
  onUpdate: () => void;
  onDiscard: () => void;
};

function describe({ added, edited, removed }: Props['summary']): string {
  const parts = [
    added && `${added} added`,
    edited && `${edited} edited`,
    removed && `${removed} removed`,
  ].filter(Boolean);
  return parts.join(', ');
}

/** Sticky bar shown while item changes are unsaved (frontend-spec §4 UpdateTripBar). */
export function UpdateTripBar({ summary, saving, error, onUpdate, onDiscard }: Props) {
  const total = summary.added + summary.edited + summary.removed;
  return (
    <div
      role="region"
      aria-label="Unsaved changes"
      className="sticky bottom-0 z-10 -mx-4 border-t border-amber-200 bg-amber-50/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur sm:mx-0 sm:rounded-xl sm:border"
    >
      {error && (
        <div className="mb-3">
          <ErrorBanner>{error}</ErrorBanner>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-amber-900">
          <span className="font-semibold">
            {total} unsaved {total === 1 ? 'change' : 'changes'}
          </span>
          <span className="text-amber-800"> · {describe(summary)}</span>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary flex-1 sm:flex-none"
            onClick={onDiscard}
            disabled={saving}
          >
            Discard changes
          </button>
          <button
            type="button"
            className="btn-primary flex-1 sm:flex-none"
            onClick={onUpdate}
            disabled={saving}
          >
            {saving ? 'Updating…' : 'Update Trip'}
          </button>
        </div>
      </div>
    </div>
  );
}
