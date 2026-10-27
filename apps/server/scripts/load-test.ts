// Usage: npm run load -- [clients=10] [opsPerClient=100]
// Requires a running server. Every client edits one shared Y.Text concurrently;
// we then assert all clients converge to byte-identical state.
import * as Y from 'yjs';
import { connect, newDoc, newUser, sleep, until } from './client.js';

const CLIENTS = Number(process.argv[2] ?? 10);
const OPS = Number(process.argv[3] ?? 100);

const owner = await newUser('load');
const docId = await newDoc(owner.cookie);
const clients = Array.from({ length: CLIENTS }, () => connect(docId, owner.cookie));
await Promise.all(clients.map((c) => c.synced));

const t0 = performance.now();
await Promise.all(
  clients.map(async (c, i) => {
    const text = c.doc.getText('load');
    for (let op = 0; op < OPS; op++) {
      // Mix inserts at random positions with occasional deletes.
      if (op % 10 === 9 && text.length > 0) text.delete(Math.floor(Math.random() * text.length), 1);
      else text.insert(Math.floor(Math.random() * (text.length + 1)), String.fromCharCode(97 + (i % 26)));
      if (op % 20 === 0) await sleep(1);
    }
  }),
);
const sent = performance.now();

const sv = (d: Y.Doc) => Buffer.from(Y.encodeStateVector(d)).toString('base64');
await until(() => new Set(clients.map((c) => sv(c.doc))).size === 1, 30_000);
const converged = performance.now();

const texts = new Set(clients.map((c) => c.doc.getText('load').toString()));
const len = clients[0].doc.getText('load').length;
console.log(JSON.stringify({
  clients: CLIENTS,
  opsPerClient: OPS,
  totalOps: CLIENTS * OPS,
  identicalText: texts.size === 1,
  finalLength: len,
  // inserts - deletes; can be higher when two clients delete the same char concurrently
  naiveExpectedLength: CLIENTS * (OPS - 2 * Math.floor(OPS / 10)),
  editPhaseMs: Math.round(sent - t0),
  convergenceMs: Math.round(converged - sent),
  totalMs: Math.round(converged - t0),
}, null, 2));
clients.forEach((c) => c.close());
process.exit(texts.size === 1 ? 0 : 1);
