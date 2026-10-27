import { useCallback, useEffect, useState } from 'react';
import { api, type DocSummary } from '../../lib/api';

export function useDocuments() {
  const [docs, setDocs] = useState<DocSummary[] | null>(null);
  const [error, setError] = useState('');

  const reload = useCallback(
    () =>
      api<{ documents: DocSummary[] }>('/documents').then(
        (r) => { setDocs(r.documents); setError(''); },
        (e: Error) => setError(e.message),
      ),
    [],
  );

  useEffect(() => { reload(); }, [reload]);

  return {
    docs,
    error,
    reload,
    create: () => api<{ document: DocSummary }>('/documents', { method: 'POST', body: '{}' }).then((r) => r.document),
    rename: async (id: string, title: string) => {
      const { document } = await api<{ document: DocSummary }>(`/documents/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) });
      setDocs((d) => d?.map((x) => (x.id === id ? document : x)) ?? null);
    },
    remove: async (id: string) => {
      await api(`/documents/${id}`, { method: 'DELETE' });
      setDocs((d) => d?.filter((x) => x.id !== id) ?? null);
    },
  };
}
