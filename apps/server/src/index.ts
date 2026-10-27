import { createServer } from 'node:http';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { attachCollaboration, createCollaboration, shutdownCollaboration } from './collaboration/hocuspocus.js';

const hocuspocus = createCollaboration();
const server = createServer(createApp((id) => hocuspocus.closeConnections(id)));
attachCollaboration(server, hocuspocus, env.WEB_ORIGIN);

server.listen(env.PORT, () => console.log(`SyncSpace server on http://localhost:${env.PORT}`));

let stopping = false;
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    if (stopping) return;
    stopping = true;
    console.log(`${sig}: flushing documents…`);
    server.close();
    await shutdownCollaboration(hocuspocus);
    process.exit(0);
  });
}
