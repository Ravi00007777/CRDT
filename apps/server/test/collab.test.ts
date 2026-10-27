import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ChildProcess } from 'node:child_process';
import { migrateTestDb, startServer, stopServer } from './server.js';
import { api, connect, newDoc, newUser, until } from '../scripts/client.js';

let server: ChildProcess;
beforeAll(async () => {
  migrateTestDb();
  server = await startServer();
}, 60_000);
afterAll(() => server && stopServer(server));

describe('REST', () => {
  it('rejects invalid input and unauthenticated requests', async () => {
    expect((await api('/api/auth/register', { method: 'POST', body: '{"email":"nope"}' })).status).toBe(400);
    expect((await api('/api/documents')).status).toBe(401);
  });

  it('hides private documents from other users', async () => {
    const alice = await newUser('alice');
    const bob = await newUser('bob');
    const id = await newDoc(alice.cookie);
    expect((await api(`/api/documents/${id}`, { cookie: bob.cookie })).status).toBe(404);
    expect((await api(`/api/documents/${id}`, { method: 'DELETE', cookie: bob.cookie })).status).toBe(404);
    const list = await api('/api/documents', { cookie: bob.cookie });
    expect(list.body.documents).toHaveLength(0);
  });
});

describe('collaboration', () => {
  it('syncs edits between two clients', async () => {
    const u = await newUser();
    const id = await newDoc(u.cookie);
    const a = connect(id, u.cookie);
    const b = connect(id, u.cookie);
    await Promise.all([a.synced, b.synced]);
    a.doc.getText('t').insert(0, 'hello');
    await until(() => b.doc.getText('t').toString() === 'hello');
    // Concurrent edits from both sides converge.
    a.doc.getText('t').insert(5, ' A');
    b.doc.getText('t').insert(0, 'B ');
    await until(() => a.doc.getText('t').toString() === b.doc.getText('t').toString() && a.doc.getText('t').length === 9);
    expect(a.doc.getText('t').toString()).toContain('hello');
    a.close();
    b.close();
  });

  it('isolates documents', async () => {
    const u = await newUser();
    const [id1, id2] = [await newDoc(u.cookie), await newDoc(u.cookie)];
    const a = connect(id1, u.cookie);
    const b = connect(id2, u.cookie);
    await Promise.all([a.synced, b.synced]);
    a.doc.getText('t').insert(0, 'only in doc 1');
    const probe = connect(id1, u.cookie);
    await until(() => probe.doc.getText('t').toString() === 'only in doc 1');
    expect(b.doc.getText('t').toString()).toBe('');
    [a, b, probe].forEach((c) => c.close());
  });

  it('refuses unauthenticated and unauthorized room joins', async () => {
    const alice = await newUser('alice');
    const mallory = await newUser('mallory');
    const id = await newDoc(alice.cookie);
    const anon = connect(id);
    const intruder = connect(id, mallory.cookie);
    const ghost = connect(crypto.randomUUID(), mallory.cookie);
    await Promise.all([anon.authFailed, intruder.authFailed, ghost.authFailed]);
    [anon, intruder, ghost].forEach((c) => c.close());
  });

  it('grants room access after sharing and kicks after revoke', async () => {
    const alice = await newUser('alice');
    const bob = await newUser('bob');
    const id = await newDoc(alice.cookie);
    expect((await api(`/api/documents/${id}/collaborators`, { method: 'POST', body: JSON.stringify({ email: bob.email }), cookie: alice.cookie })).status).toBe(201);
    const b = connect(id, bob.cookie);
    await b.synced;
    await api(`/api/documents/${id}/collaborators/${bob.id}`, { method: 'DELETE', cookie: alice.cookie });
    // Revocation closes the room; Bob's automatic reconnect must now fail auth.
    await b.authFailed;
    b.close();
  });

  it('persists document state across a server restart', async () => {
    const u = await newUser();
    const id = await newDoc(u.cookie);
    const a = connect(id, u.cookie);
    await a.synced;
    a.doc.getText('t').insert(0, 'survives restart');
    a.doc.getMap('m').set('k', 42);
    await until(() => !a.provider.hasUnsyncedChanges);
    a.close();

    await stopServer(server);
    server = await startServer();

    const b = connect(id, u.cookie);
    await b.synced;
    expect(b.doc.getText('t').toString()).toBe('survives restart');
    expect(b.doc.getMap('m').get('k')).toBe(42);
    b.close();
  }, 30_000);
});
