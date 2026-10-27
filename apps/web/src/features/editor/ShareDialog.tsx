import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, type User } from '../../lib/api';
import { Avatar } from '../../components/Avatar';

export function ShareDialog({ documentId, open, onClose }: { documentId: string; open: boolean; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [people, setPeople] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = ref.current!;
    if (open) {
      d.showModal();
      api<{ collaborators: User[] }>(`/documents/${documentId}/collaborators`).then((r) => setPeople(r.collaborators)).catch((e) => setError(e.message));
    } else if (d.open) d.close();
  }, [open, documentId]);

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError('');
    try {
      const { collaborator } = await api<{ collaborator: User }>(`/documents/${documentId}/collaborators`, {
        method: 'POST',
        body: JSON.stringify({ email: new FormData(form).get('email') }),
      });
      setPeople((p) => [...p.filter((x) => x.id !== collaborator.id), collaborator]);
      form.reset();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    try {
      await api(`/documents/${documentId}/collaborators/${id}`, { method: 'DELETE' });
      setPeople((p) => p.filter((x) => x.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <dialog ref={ref} onClose={onClose} className="m-auto w-[min(92vw,28rem)] rounded-xl border border-line bg-white p-6 shadow-xl backdrop:bg-black/30">
      <h2 className="text-lg font-semibold">Share document</h2>
      <p className="mt-1 text-sm text-muted">People you add can open and edit this document.</p>
      <form onSubmit={add} className="mt-4 flex gap-2">
        <input name="email" type="email" required placeholder="teammate@example.com" aria-label="Email to share with"
          className="flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-ink/40" />
        <button disabled={busy} className="rounded-lg bg-ink px-3 text-sm font-medium text-white disabled:opacity-60">Add</button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      <ul className="mt-4 divide-y divide-line">
        {people.length === 0 && <li className="py-3 text-sm text-muted">Only you have access.</li>}
        {people.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2.5">
            <Avatar id={p.id} name={p.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.name}</p>
              <p className="truncate text-xs text-muted">{p.email}</p>
            </div>
            <button onClick={() => revoke(p.id)} className="text-xs text-red-600 hover:underline">Remove</button>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex justify-end">
        <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm hover:bg-black/5">Done</button>
      </div>
    </dialog>
  );
}
