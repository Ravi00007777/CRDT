import type { Server as HttpServer, IncomingMessage } from 'node:http';
import { WebSocketServer } from 'ws';
import { Hocuspocus } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { userIdFromCookieHeader } from '../auth/session.js';
import { getAccess } from '../auth/access.js';
import { loadState, storeState } from '../persistence/ydoc.js';
import { prisma } from '../db.js';

export const COLLAB_PATH = '/collab';
const MAX_MESSAGE_BYTES = 2 * 1024 * 1024;

export type CollabContext = { userId: string };

export function createCollaboration() {
  return new Hocuspocus<CollabContext>({
    quiet: true,
    debounce: 1000,
    maxDebounce: 5000,
    async onAuthenticate({ requestHeaders, documentName }) {
      const userId = userIdFromCookieHeader(requestHeaders.get('cookie'));
      if (!userId) throw new Error('Not authenticated');
      if (!(await getAccess(userId, documentName))) throw new Error('Forbidden');
      return { userId };
    },
    extensions: [
      new Database({
        fetch: ({ documentName }) => loadState(documentName),
        async store({ documentName, state }) {
          try {
            const ok = await storeState(documentName, state);
            if (!ok) console.warn(`[collab] skipped store for deleted document ${documentName}`);
          } catch (err) {
            // Rethrow so Hocuspocus keeps the doc in memory; next debounce retries.
            console.error(`[collab] failed to persist ${documentName}`, err);
            throw err;
          }
        },
      }),
    ],
  });
}

function toWebRequest(req: IncomingMessage) {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  }
  return new Request(`http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`, { headers });
}

/** Attach Hocuspocus to an existing HTTP server on COLLAB_PATH. */
export function attachCollaboration(server: HttpServer, hocuspocus: Hocuspocus<CollabContext>, allowedOrigin: string) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });

  server.on('upgrade', (req, socket, head) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    const origin = req.headers.origin;
    // Browsers always send Origin; block cross-site WebSocket hijacking with our cookie.
    if (path !== COLLAB_PATH || (origin && origin !== allowedOrigin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      return socket.destroy();
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const conn = hocuspocus.handleConnection(ws, toWebRequest(req));
      ws.on('message', (data: Buffer) => conn.handleMessage(new Uint8Array(data)));
      ws.on('close', (code, reason) => conn.handleClose({ code, reason: reason.toString() } as CloseEvent));
      ws.on('pong', () => conn.touch());
      const ping = setInterval(() => ws.ping(), 15_000);
      ws.on('close', () => clearInterval(ping));
      ws.on('error', (err) => console.error('[collab] socket error', err));
    });
  });

  return wss;
}

/**
 * Force every client in a room to reconnect and re-authenticate. Closing the raw sockets
 * (not just the per-document channel) makes the provider redo auth, so users who lost
 * access are rejected while everyone else rejoins transparently.
 */
export function kickRoom(hocuspocus: Hocuspocus<CollabContext>, documentName: string) {
  hocuspocus.documents.get(documentName)?.connections.forEach((_clients, connection) => {
    connection.webSocket.close(4001, 'Access changed');
  });
}

/** Store all in-memory documents before exit. */
export async function shutdownCollaboration(hocuspocus: Hocuspocus<CollabContext>) {
  hocuspocus.closeConnections();
  hocuspocus.flushPendingStores();
  // Give pending stores a moment to hit the database.
  for (let i = 0; i < 50 && hocuspocus.getDocumentsCount() > 0; i++) await new Promise((r) => setTimeout(r, 100));
  await prisma.$disconnect();
}
