import { useEffect, useRef } from 'react';

type Props = { open: boolean; title: string; body: string; confirmLabel: string; busy?: boolean; onConfirm(): void; onCancel(): void };

export function ConfirmDialog({ open, title, body, confirmLabel, busy, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} onCancel={onCancel} className="m-auto w-[min(92vw,26rem)] rounded-xl border border-line bg-white p-6 shadow-xl backdrop:bg-black/30">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted">{body}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg px-3 py-2 text-sm hover:bg-black/5">Cancel</button>
        <button onClick={onConfirm} disabled={busy} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
