import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Spinner } from '../components/Spinner';
import { useAuth } from '../features/auth/AuthContext';
import { useDocuments } from '../features/documents/useDocuments';
import type { DocSummary } from '../lib/api';
import { timeAgo } from '../lib/time';

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  const { docs, error, create, rename, remove, reload } = useDocuments();
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<DocSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState('');

  async function onCreate() {
    setCreating(true);
    try {
      navigate(`/d/${(await create()).id}`);
    } catch (e) {
      setActionError((e as Error).message);
      setCreating(false);
    }
  }

  async function onDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await remove(toDelete.id);
      setToDelete(null);
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  const mine = docs?.filter((d) => d.ownerId === user!.id) ?? [];
  const shared = docs?.filter((d) => d.ownerId !== user!.id) ?? [];

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl">Your documents</h1>
            <p className="mt-1 text-sm text-muted">Everything you own or that's been shared with you.</p>
          </div>
          <button onClick={onCreate} disabled={creating} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-60">
            {creating ? 'Creating…' : '+ New document'}
          </button>
        </div>

        {(notice || actionError || error) && (
          <p role="alert" className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {actionError || error || notice}
            {error && <button onClick={reload} className="ml-2 underline">Retry</button>}
          </p>
        )}

        {!docs && !error && <div className="mt-16 flex justify-center"><Spinner label="Loading documents" /></div>}

        {docs && docs.length === 0 && (
          <div className="mt-12 rounded-2xl border border-dashed border-line px-6 py-16 text-center">
            <p className="font-serif text-xl">A blank page is waiting.</p>
            <p className="mt-2 text-sm text-muted">Create your first document and share the link to write together in real time.</p>
          </div>
        )}

        {mine.length > 0 && <DocGrid title="Owned by you" docs={mine} onRename={rename} onDelete={setToDelete} canDelete />}
        {shared.length > 0 && <DocGrid title="Shared with you" docs={shared} onRename={rename} />}
      </main>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete document?"
        body={`"${toDelete?.title}" will be permanently deleted for everyone it's shared with.`}
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={onDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

type GridProps = { title: string; docs: DocSummary[]; canDelete?: boolean; onRename(id: string, t: string): Promise<void>; onDelete?(d: DocSummary): void };

function DocGrid({ title, docs, canDelete, onRename, onDelete }: GridProps) {
  return (
    <section className="mt-10">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {docs.map((d) => <DocCard key={d.id} doc={d} canDelete={canDelete} onRename={onRename} onDelete={onDelete} />)}
      </ul>
    </section>
  );
}

function DocCard({ doc, canDelete, onRename, onDelete }: { doc: DocSummary; canDelete?: boolean; onRename: GridProps['onRename']; onDelete?: GridProps['onDelete'] }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');

  async function save(value: string) {
    setEditing(false);
    const t = value.trim();
    if (!t || t === doc.title) return;
    try { await onRename(doc.id, t); setError(''); } catch (e) { setError((e as Error).message); }
  }

  return (
    <li className="group relative rounded-xl border border-line bg-white p-4 transition hover:border-ink/20 hover:shadow-sm">
      <div className="mb-6 h-16 rounded-md bg-[repeating-linear-gradient(transparent,transparent_9px,#efebe4_9px,#efebe4_10px)]" aria-hidden />
      {editing ? (
        <input
          autoFocus
          defaultValue={doc.title}
          aria-label="Document title"
          maxLength={200}
          onBlur={(e) => save(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false); }}
          className="w-full rounded border border-line px-1 font-medium outline-none"
        />
      ) : (
        <Link to={`/d/${doc.id}`} className="block truncate font-medium after:absolute after:inset-0">{doc.title}</Link>
      )}
      <p className="mt-1 text-xs text-muted">
        Edited {timeAgo(doc.updatedAt)}{!canDelete && ` · ${doc.owner.name}`}
      </p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <div className="absolute right-3 top-3 z-10 flex gap-1 opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <button onClick={() => setEditing(true)} className="rounded-md bg-white/90 px-2 py-1 text-xs text-muted shadow-sm hover:text-ink">Rename</button>
        {canDelete && <button onClick={() => onDelete?.(doc)} className="rounded-md bg-white/90 px-2 py-1 text-xs text-red-600 shadow-sm hover:text-red-700">Delete</button>}
      </div>
    </li>
  );
}
