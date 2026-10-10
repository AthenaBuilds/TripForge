import type { ReactNode } from 'react';

type Props = { children: ReactNode; onDismiss?: () => void };

export function ErrorBanner({ children, onDismiss }: Props) {
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      <div>{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded px-1 font-semibold hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-red-600"
          aria-label="Dismiss error"
        >
          ✕
        </button>
      )}
    </div>
  );
}
