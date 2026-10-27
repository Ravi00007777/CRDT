import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { Spinner } from '../components/Spinner';
import { useAuth } from '../features/auth/AuthContext';
import { CollabEditor } from '../features/editor/CollabEditor';
import { ConnectionBadge, PresenceStack } from '../features/editor/Presence';
import { ShareDialog } from '../features/editor/ShareDialog';
import { useCollab } from '../features/editor/useCollab';
import { api, ApiError, type DocSummary } from '../lib/api';
import { colorFor } from '../lib/color';

/** Remount per document so all state (meta, errors, collab session) resets cleanly. */
export function EditorPage() {
  const { id = '' } = useParams();
  return <DocumentEditor key={id} id={id} />;
}

function DocumentEditor({ id }: { id: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [meta, setMeta] = useState<{ document: DocSummary; access: 'owner' | 'editor' } | null>(null);
  const [error, setError] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api<{ document: DocSummary; access: 'owner' | 'editor' }>(`/documents/${id}`)
      .then(setMeta)
      .catch((e) => setError(e instanceof ApiError && e.status === 404 ? 'This document does not exist or you do not have access.' : e.message));
  }, [id]);

  // Collab server refused us (deleted or access revoked): leave the editor.
  const onAuthFailed = useCallback(() => {
    navigate('/', { replace: true, state: { notice: 'That document was deleted or your access was removed.' } });
  }, [navigate]);

  const { session, status, synced, ready, peers } = useCollab(meta ? id : '', onAuthFailed);

  async function saveTitle(value: string) {
    const title = value.trim();
    if (!meta || !title || title === meta.document.title) return;
    try {
      const { document } = await api<{ document: DocSummary }>(`/documents/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) });
      setMeta({ ...meta, document });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (error && !meta) {
    return (
      <>
        <AppHeader />
        <main className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="font-serif text-2xl">Can't open this document</h1>
          <p className="mt-2 text-muted">{error}</p>
          <Link to="/" className="mt-6 inline-block rounded-lg bg-ink px-4 py-2 text-sm text-white">Back to documents</Link>
        </main>
      </>
    );
  }

  const self = { id: user!.id, name: user!.name, color: colorFor(user!.id) };

  return (
    <>
      <AppHeader>
        <Link to="/" className="whitespace-nowrap rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-black/5 hover:text-ink" aria-label="Back to documents">← Docs</Link>
        <div className="hidden sm:block"><ConnectionBadge status={status} synced={synced} /></div>
        <div className="ml-auto flex items-center gap-2">
          <PresenceStack peers={peers} selfId={self.id} />
          <button onClick={copyLink} className="whitespace-nowrap rounded-lg border border-line px-2.5 py-1.5 text-sm hover:bg-black/5">{copied ? 'Copied!' : <>Copy<span className="hidden sm:inline"> link</span></>}</button>
          {meta?.access === 'owner' && (
            <button onClick={() => setShareOpen(true)} className="whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-sm font-medium text-white hover:bg-black">Share</button>
          )}
        </div>
      </AppHeader>

      <main className="mx-auto max-w-3xl px-4 pb-32 pt-10 sm:px-8">
        {!meta ? (
          <div className="flex justify-center py-20"><Spinner label="Loading document" /></div>
        ) : (
          <>
            <input
              key={meta.document.title}
              defaultValue={meta.document.title}
              aria-label="Document title"
              maxLength={200}
              onBlur={(e) => saveTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className="mb-4 w-full bg-transparent font-serif text-3xl font-bold outline-none placeholder:text-muted sm:text-4xl"
            />
            {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}
            <div className="sm:hidden mb-2"><ConnectionBadge status={status} synced={synced} /></div>
            {session && ready ? <CollabEditor key={id} session={session} user={self} /> : <div className="flex justify-center py-20"><Spinner label="Connecting" /></div>}
          </>
        )}
      </main>
      {meta?.access === 'owner' && <ShareDialog documentId={id} open={shareOpen} onClose={() => setShareOpen(false)} />}
    </>
  );
}
