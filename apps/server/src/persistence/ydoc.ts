import * as Y from 'yjs';
import { prisma } from '../db.js';

export async function loadState(documentId: string): Promise<Uint8Array | null> {
  const doc = await prisma.document.findUnique({ where: { id: documentId }, select: { ydoc: true } });
  return doc?.ydoc ?? null;
}

/**
 * Merge-on-write: lock the row, merge stored state with the incoming state, write back.
 * Yjs merges are commutative and idempotent, so racing or out-of-order saves can never
 * drop updates that another save already persisted.
 * Returns false if the document no longer exists.
 */
export async function storeState(documentId: string, state: Uint8Array): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ ydoc: Uint8Array | null }[]>`
      SELECT "ydoc" FROM "Document" WHERE "id" = ${documentId} FOR UPDATE`;
    if (rows.length === 0) return false;
    const prev = rows[0].ydoc;
    const merged = prev ? Y.mergeUpdates([prev, state]) : state;
    await tx.document.update({ where: { id: documentId }, data: { ydoc: Buffer.from(merged) } });
    return true;
  });
}
