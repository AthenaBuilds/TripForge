import { useState } from 'react';
import type { ExportFormat } from '@tripforge/shared';
import { saveBlob } from '../api/download';
import { errorMessage } from '../api/messages';
import { ErrorBanner } from './ErrorBanner';

type Props = {
  /** Fetches the file; omit when the trip isn't saved yet (button is disabled). */
  download?: (format: ExportFormat) => Promise<{ blob: Blob; filename: string }>;
};

const FORMATS: Array<{ format: ExportFormat; label: string }> = [
  { format: 'pdf', label: 'PDF' },
  { format: 'xlsx', label: 'Excel' },
];

export function ExportButton({ download }: Props) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport(format: ExportFormat) {
    if (!download) return;
    setBusy(format);
    setError(null);
    try {
      const { blob, filename } = await download(format);
      saveBlob(blob, filename);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div role="group" aria-label="Export" className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-700">Export:</span>
        {FORMATS.map(({ format, label }) => (
          <button
            key={format}
            type="button"
            className="btn-secondary"
            disabled={!download || busy !== null}
            aria-describedby={download ? undefined : 'export-hint'}
            onClick={() => handleExport(format)}
          >
            {busy === format ? `Preparing ${label}…` : label}
          </button>
        ))}
        {!download && (
          <span id="export-hint" className="text-sm text-slate-500">
            Save the trip to export
          </span>
        )}
      </div>
      {error && <ErrorBanner onDismiss={() => setError(null)}>{error}</ErrorBanner>}
    </div>
  );
}
