import { prisma } from '../db.js';

export type Access = 'owner' | 'editor' | null;

/** Single source of truth for document authorization (REST and WebSocket). */
export async function getAccess(userId: string, documentId: string): Promise<Access> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { ownerId: true, access: { where: { userId }, select: { userId: true } } },
  });
  if (!doc) return null;
  if (doc.ownerId === userId) return 'owner';
  return doc.access.length ? 'editor' : null;
}
