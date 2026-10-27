// Headless SyncSpace client used by the load test and integration tests.
import WebSocket from 'ws';
import * as Y from 'yjs';
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';

export const BASE = process.env.SYNCSPACE_URL ?? 'http://localhost:4000';

export async function api(path: string, init: RequestInit & { cookie?: string } = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.cookie ? { cookie: init.cookie } : {}) },
  });
  const cookie = res.headers.get('set-cookie')?.split(';')[0];
  const body = res.status === 204 ? null : await res.json();
  return { status: res.status, body, cookie };
}

export async function newUser(tag = 'u') {
  const email = `${tag}-${crypto.randomUUID().slice(0, 8)}@test.local`;
  const r = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password: 'password123', name: tag }) });
  if (r.status !== 201 || !r.cookie) throw new Error(`register failed: ${r.status}`);
  return { email, cookie: r.cookie, id: r.body.user.id as string };
}

export async function newDoc(cookie: string) {
  const r = await api('/api/documents', { method: 'POST', body: '{}', cookie });
  return r.body.document.id as string;
}

export type Client = { doc: Y.Doc; provider: HocuspocusProvider; synced: Promise<void>; authFailed: Promise<string>; close(): void };

export function connect(documentId: string, cookie?: string): Client {
  const headers = cookie ? { cookie } : {};
  class CookieWebSocket extends WebSocket {
    constructor(url: string, protocols?: string | string[]) {
      super(url, protocols, { headers });
    }
  }
  const doc = new Y.Doc();
  const ws = new HocuspocusProviderWebsocket({ url: BASE.replace(/^http/, 'ws') + '/collab', WebSocketPolyfill: CookieWebSocket, maxAttempts: 3 });
  let onSynced!: () => void;
  let onFail!: (r: string) => void;
  const synced = new Promise<void>((r) => (onSynced = r));
  const authFailed = new Promise<string>((r) => (onFail = r));
  const provider = new HocuspocusProvider({
    websocketProvider: ws,
    name: documentId,
    document: doc,
    token: '',
    onSynced: () => onSynced(),
    onAuthenticationFailed: ({ reason }) => onFail(reason),
  });
  provider.attach();
  return { doc, provider, synced, authFailed, close: () => { provider.destroy(); ws.destroy(); } };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function until(cond: () => boolean, timeoutMs = 10_000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('timeout waiting for condition');
    await sleep(20);
  }
}
