import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';

export type ConnStatus = 'connecting' | 'connected' | 'disconnected';
export type Peer = { clientId: number; id: string; name: string; color: string };
export type CollabSession = { doc: Y.Doc; provider: HocuspocusProvider };

const collabUrl = () => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/collab`;

/**
 * One Y.Doc + provider per document, torn down on unmount/doc change.
 * Auth rides on the httpOnly session cookie sent with the WebSocket upgrade.
 */
export function useCollab(documentId: string, onAuthFailed: () => void) {
  const [session, setSession] = useState<CollabSession | null>(null);
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [synced, setSynced] = useState(false);
  // Latches true after first sync so the editor stays mounted through disconnects.
  const [ready, setReady] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);

  useEffect(() => {
    if (!documentId) return;
    const doc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: collabUrl(),
      name: documentId,
      document: doc,
      token: '', // real credential is the cookie; never put secrets in the URL
      onStatus: ({ status }) => setStatus(status as ConnStatus),
      onSynced: ({ state }) => {
        setSynced(state);
        if (state) setReady(true);
      },
      onAuthenticationFailed: () => onAuthFailed(),
    });
    const onAwareness = () => {
      const list: Peer[] = [];
      provider.awareness?.getStates().forEach((s, clientId) => {
        if (s.user) list.push({ clientId, ...s.user });
      });
      setPeers(list);
    };
    provider.awareness?.on('change', onAwareness);
    setSession({ doc, provider });
    return () => {
      provider.awareness?.off('change', onAwareness);
      provider.destroy();
      doc.destroy();
      setSession(null);
      setSynced(false);
      setReady(false);
      setPeers([]);
    };
    // onAuthFailed intentionally excluded: reconnecting on every render would drop state.
  }, [documentId]);

  return { session, status, synced, ready, peers };
}
