# Architecture

```
Browser (React + Tiptap)                 Node process (:4000)                     PostgreSQL
┌──────────────────────────┐   /api    ┌──────────────────────────────┐        ┌──────────────┐
│ Dashboard, auth pages     │─────────▶│ Express: auth, documents,    │──────▶ │ User          │
│                           │  cookie  │ sharing (Zod, errors)        │ Prisma │ Document      │
│ Tiptap ⇄ Y.Doc            │          │                              │        │  └ ydoc bytea │
│  Collaboration ext.       │  /collab │ ws upgrade → Hocuspocus      │        │ DocumentAccess│
│  CollaborationCaret ext.  │◀────────▶│  onAuthenticate (cookie+ACL) │──────▶ │              │
│ HocuspocusProvider        │ Yjs sync │  Database ext. fetch/store   │        └──────────────┘
└──────────────────────────┘ +awareness└──────────────────────────────┘
         ▲ Vite dev proxy makes /api and /collab same-origin
```

## Modules (apps/server/src)

| Path | Responsibility |
| --- | --- |
| `config/env.ts` | Zod-validated environment; refuses to start without a strong `JWT_SECRET` |
| `auth/session.ts` | bcrypt (cost 12), HS256 JWT in an httpOnly `SameSite=Lax` cookie, cookie parsing for WebSocket |
| `auth/access.ts` | `getAccess(user, doc)`: the single authorization check used by REST and WebSocket |
| `api/auth.ts`, `api/documents.ts` | REST routes; 404 for both missing and forbidden documents |
| `middleware/` | `requireAuth`, centralized error handler (Zod → 400, body limit → 413, unknown → 500 without details) |
| `persistence/ydoc.ts` | Load and merge-on-write store of canonical Yjs state |
| `collaboration/hocuspocus.ts` | Hocuspocus config, WS attachment, room kick, graceful flush |

## Collaboration flow

1. The browser opens `ws://<web origin>/collab`. Vite proxies it, so the httpOnly session cookie rides along on the upgrade. No token ever goes in the URL or in JS.
2. On upgrade the server rejects any path except `/collab` and any foreign `Origin` (cross-site WebSocket hijacking).
3. The provider sends an auth message for document `<uuid>`. `onAuthenticate` verifies the JWT from the cookie header and calls `getAccess`. A failure means the room is never loaded for that socket. A guessed room ID gets the same result as a forbidden one.
4. Hocuspocus loads the doc via `fetch` (Postgres) **before** syncing any client. Sync step 1/2 exchanges state vectors, so reconnecting clients send and receive only the missing updates.
5. Each Tiptap transaction becomes a Yjs update and is broadcast to the room. Updates are incremental CRDT operations, never full-text replacement.
6. Awareness (y-protocols) carries `{id, name, color}` plus the cursor for each client. Closed sockets drop their awareness state, so presence updates on disconnect. The UI collapses multiple tabs of one person into one avatar.

## Persistence: merge-on-write

`Document.ydoc` holds `Y.encodeStateAsUpdate(doc)`. It is the canonical state, and no HTML is stored anywhere.

Hocuspocus calls `store` debounced (1 s, max 5 s) and on the last disconnect. `storeState` does:

```sql
BEGIN;
SELECT ydoc FROM "Document" WHERE id = $1 FOR UPDATE;   -- serialize writers per doc
-- merged = Y.mergeUpdates([stored, incoming])
UPDATE "Document" SET ydoc = merged, "updatedAt" = now() WHERE id = $1;
COMMIT;
```

Yjs updates form a state-based CRDT: merging is **commutative, associative and idempotent**. Even if two stores race or commit out of order (for example a slow debounced store finishing after a newer one), the result contains every update either of them carried. A stale snapshot can never overwrite newer state. The row lock just keeps read-merge-write atomic.

Failure handling: if `store` throws, it is logged and rethrown. Hocuspocus then keeps the document in memory and the next debounce retries. Store on a deleted document is a no-op that logs a warning. On SIGINT/SIGTERM the server closes connections, flushes pending stores and waits for documents to unload before exiting. The restart integration test checks this path.

## Revocation

When a document is deleted or a collaborator removed, the server closes the **raw sockets** of everyone in that room (close code 4001). Hocuspocus's own `closeConnections` only sends a per-document CLOSE message, after which the provider sits unauthenticated without retrying. Closing the socket instead makes every provider reconnect and re-authenticate: users who still have access rejoin transparently, revoked users get `authenticationFailed`, and the editor sends them back to the dashboard.

## Security summary

- Passwords: bcrypt cost 12. Sessions: 7-day HS256 JWT in an httpOnly cookie (`Secure` in production).
- CSRF: `SameSite=Lax` plus a server-side Origin check on all non-GET REST calls.
- WebSocket: Origin check on upgrade, cookie auth plus an ACL check per document, 2 MB max frame, Hocuspocus pre-auth queue limits.
- Input: Zod on every body. JSON body limit 32 KB. UUID validation on IDs.
- Errors: generic 500s with no stack traces. 404 rather than 403 for documents you can't see.

## Tradeoffs and what was deliberately left out

| Decision | Why | Revisit when |
| --- | --- | --- |
| Single process for REST + WS | Revocation needs the Hocuspocus instance; simplest deploy | Multiple instances → Redis extension + pub/sub kick |
| Snapshot row, not update log | Small code, fast load; merge makes it race-safe | Need history/audit → append-only updates + compaction |
| Debounced persistence (≤5 s) | Avoids a write per keystroke | Crash-loss budget must be ~0 → persist each update to a log |
| All collaborators are editors | Scope for the demo | Add `role` to `DocumentAccess` + `connectionConfig.readOnly` |
| Cookie auth for WS via proxy | One credential, nothing in JS | Separate origins → short-lived token endpoint |
