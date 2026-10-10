import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TripDetail } from '@tripforge/shared';
import { queryKeys, tripsApi } from '../../api/endpoints';
import { errorMessage } from '../../api/messages';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorBanner } from '../../components/ErrorBanner';

export function shareUrl(slug: string): string {
  return `${window.location.origin}/shared/${slug}`;
}

type Props = { trip: TripDetail };

export function ShareTripPanel({ trip }: Props) {
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<'stop' | 'regenerate' | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.trip(trip.id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.trips, exact: true }),
    ]);

  const mutation = useMutation({
    mutationFn: async (action: 'share' | 'stop' | 'regenerate') => {
      if (action !== 'share') await tripsApi.unshare(trip.id);
      if (action !== 'stop') await tripsApi.share(trip.id);
    },
    onMutate: () => {
      setError(null);
      setCopied(false);
    },
    onSettled: refresh,
    onError: (err) => setError(errorMessage(err)),
  });

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError('Could not copy automatically. Select the link and copy it.');
    }
  }

  const url = trip.shareSlug ? shareUrl(trip.shareSlug) : null;

  return (
    <section aria-labelledby="share-heading" className="card space-y-3 p-4">
      <h2 id="share-heading" className="font-semibold">
        Share
      </h2>
      {!url ? (
        <>
          <p className="text-sm text-slate-600">
            Create a read-only link anyone can open without an account.
          </p>
          <button
            type="button"
            className="btn-primary"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate('share')}
          >
            {mutation.isPending ? 'Creating link…' : 'Share'}
          </button>
        </>
      ) : (
        <>
          <label htmlFor="share-url" className="field-label">
            Read-only link
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="share-url"
              readOnly
              value={url}
              className="field-input font-mono text-sm"
              onFocus={(e) => e.target.select()}
            />
            <button type="button" className="btn-primary shrink-0" onClick={() => copy(url)}>
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={mutation.isPending}
              onClick={() => setConfirm('regenerate')}
            >
              New link
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={mutation.isPending}
              onClick={() => setConfirm('stop')}
            >
              Stop sharing
            </button>
          </div>
        </>
      )}
      {error && <ErrorBanner onDismiss={() => setError(null)}>{error}</ErrorBanner>}

      {confirm && (
        <ConfirmDialog
          title={confirm === 'stop' ? 'Stop sharing this trip?' : 'Create a new link?'}
          onCancel={() => setConfirm(null)}
          actions={[
            {
              label: confirm === 'stop' ? 'Stop sharing' : 'Create new link',
              variant: 'danger',
              onClick: () => {
                mutation.mutate(confirm);
                setConfirm(null);
              },
            },
          ]}
        >
          The current link will stop working immediately for everyone who has it.
        </ConfirmDialog>
      )}
    </section>
  );
}
