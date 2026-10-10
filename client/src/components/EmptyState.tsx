import type { ReactNode } from 'react';

type Props = { title: string; children?: ReactNode };

export function EmptyState({ title, children }: Props) {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-300 px-6 py-10 text-center">
      <p className="font-heading text-lg font-semibold text-slate-700">{title}</p>
      {children && <div className="mt-2 text-sm text-slate-600">{children}</div>}
    </div>
  );
}
