import { useEffect, useRef, type ReactNode } from 'react';

export type ConfirmAction = {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'danger' | 'secondary';
};

type Props = {
  title: string;
  children?: ReactNode;
  actions: ConfirmAction[];
  onCancel: () => void;
};

/** A modal built on <dialog>, so focus trapping and Escape come from the browser. */
export function ConfirmDialog({ title, children, actions, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal?.();
  }, []);

  const classFor = (variant: ConfirmAction['variant']) =>
    variant === 'danger' ? 'btn-danger' : variant === 'secondary' ? 'btn-secondary' : 'btn-primary';

  return (
    <dialog
      ref={ref}
      open
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="fixed inset-0 m-auto w-[min(28rem,calc(100%-2rem))] rounded-xl p-0 shadow-xl backdrop:bg-slate-900/40"
    >
      <div className="p-5">
        <h2 id="confirm-title" className="text-lg font-semibold">
          {title}
        </h2>
        {children && <div className="mt-2 text-sm text-slate-700">{children}</div>}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          {actions.map((a) => (
            <button key={a.label} type="button" className={classFor(a.variant)} onClick={a.onClick}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </dialog>
  );
}
