# SyncSpace

Real-time collaborative rich-text editor (Google Docs-style), built on **Yjs** (CRDT) and a self-hosted **Hocuspocus** WebSocket server, with durable state in **PostgreSQL**.

- React + TypeScript + Vite + Tailwind, Tiptap v3 editor
- Express 5 + Hocuspocus 4 (same Node process), Prisma 7, Zod
- Vitest integration tests, Playwright E2E, headless load test

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for design and tradeoffs.

## Prerequisites

- Node.js 22+ (developed on 24)
- PostgreSQL 14+ running locally (developed on 18 via Homebrew: `brew services start postgresql@18`)

## Setup

```bash
npm install                                  # installs both apps, generates Prisma client
createdb syncspace && createdb syncspace_test
cp .env.example apps/server/.env             # then fill in values (see below)
npm run db:migrate                           # applies Prisma migrations
npm run seed                                 # optional: demo users + shared doc
npm run dev                                  # API+collab on :4000, web on :5173
```

Open http://localhost:5173. For a two-user demo, use a normal and an incognito window
(`alice@demo.local` / `bob@demo.local`, password `password123` after seeding).

## Docker (alternative)

Runs Postgres plus a single app container (Express serves the built web app, so everything is on one origin):

```bash
export JWT_SECRET=$(openssl rand -hex 32)
docker compose up --build        # http://localhost:4000
```

Containers are capped (app 1 CPU / 512 MB, db 0.5 CPU / 256 MB) to keep a laptop cool. For the live demo, the native setup above is lighter still, because Docker Desktop runs its own VM.

> The compose file and Dockerfile have not been run here, since Docker isn't installed on the dev machine. The production code path they use (`npm run build`, then `node dist/index.js` serving web + API + WebSocket on :4000 with `COOKIE_SECURE=false`) was tested locally.

## Environment (`apps/server/.env`)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string, e.g. `postgresql://USER@localhost:5432/syncspace` |
| `JWT_SECRET` | ≥32 random chars for signing session cookies: `openssl rand -hex 32` |
| `PORT` | Server port (default 4000) |
| `WEB_ORIGIN` | Allowed browser origin for REST writes and WebSocket upgrades (default `http://localhost:5173`) |
| `COOKIE_SECURE` | Optional `true`/`false`; defaults to `true` when `NODE_ENV=production`. Set `false` for plain-http localhost |

Tests use `TEST_DATABASE_URL` if set, otherwise `postgresql://$USER@localhost:5432/syncspace_test`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Server (tsx watch) + Vite dev server with `/api` and `/collab` proxied |
| `npm run build` | Type-check and build both apps |
| `npm run typecheck` | TypeScript checks |
| `npm run lint` | ESLint (typescript-eslint + react-hooks), flat config in `eslint.config.js` |
| `npm test` | Server integration tests (spawns a real server on :4100 against the test DB) |
| `npm run test:e2e` | Playwright browser tests (starts/reuses `npm run dev`) |
| `npm run load -- [clients] [ops]` | Headless load test against a running server (default 10 × 100) |
| `npm run seed` | Idempotent demo data |

## Verified results (2026-10-27, MacBook, local Postgres 18)

**Server integration tests: 7/7 passed**
- REST rejects invalid input (400) and unauthenticated calls (401)
- Private documents return 404 to other users (no existence leak)
- Two clients sync edits; concurrent inserts converge
- Separate documents do not receive each other's updates
- Unauthenticated, unauthorized and non-existent rooms are refused by the collab server
- Sharing grants room access; revoking kicks the socket and the reconnect is refused
- Text and map state survive a server restart (SIGTERM → start)

**Playwright E2E: 3/3 passed** (also passed with `--repeat-each=2`)
- Two browser contexts / two users: share via UI, live typing, heading formatting, concurrent typing converges to identical document HTML, remote caret label, presence 2 → 1 on disconnect, reload restores content
- Isolation across documents, same doc in two tabs, other user blocked by URL
- Delete with confirmation dialog

**Load test** (each client concurrently inserts/deletes in one shared `Y.Text`, then all clients' state vectors must match):

| Clients × ops | Total ops | Converged identically | Edit phase | Convergence after last op |
| --- | --- | --- | --- | --- |
| 10 × 100 (3 runs) | 1,000 | yes, yes, yes | 55–63 ms | 21–22 ms |
| 50 × 200 | 10,000 | yes | 1,136 ms | 46 ms |

Final length is slightly above inserts − deletes (e.g. 804 vs 800) because two clients sometimes delete the same character concurrently, which Yjs correctly counts once.

## Known limitations

- Every shared user is an editor; there are no viewer/commenter roles.
- Document titles go through REST and are not live-synced; collaborators see a rename on their next load.
- State is persisted 1 s after edits stop (at most every 5 s). A graceful stop flushes everything, but a hard crash (`kill -9`, power loss) can lose up to ~5 s of edits.
- One server process. Horizontal scaling would need the Hocuspocus Redis extension.
- Docker setup is untested (Docker not available on the dev machine).
