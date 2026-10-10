type Props = { label?: string; fullPage?: boolean };

export function LoadingSpinner({ label = 'Loading', fullPage = false }: Props) {
  return (
    <div
      role="status"
      className={`flex items-center justify-center gap-3 text-slate-600 ${fullPage ? 'min-h-[50vh]' : 'py-6'}`}
    >
      <span
        aria-hidden="true"
        className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-sky-700"
      />
      <span className="text-sm">{label}…</span>
    </div>
  );
}
