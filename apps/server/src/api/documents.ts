import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { getAccess } from '../auth/access.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { HttpError } from '../middleware/errors.js';

const titleBody = z.object({ title: z.string().trim().min(1).max(200) });
const shareBody = z.object({ email: z.string().trim().toLowerCase().email() });
const idParam = z.string().uuid();

const summary = {
  id: true,
  title: true,
  updatedAt: true,
  ownerId: true,
  owner: { select: { name: true, email: true } },
} as const;

/** Called after access changes so connected clients re-authenticate (or get kicked). */
export type KickRoom = (documentId: string) => void;

export function documentsRouter(kickRoom: KickRoom) {
  const r = Router();
  r.use(requireAuth);

  async function requireDoc(userId: string, rawId: string, ownerOnly = false) {
    const id = idParam.safeParse(rawId);
    const access = id.success ? await getAccess(userId, id.data) : null;
    // 404 for both missing and forbidden: don't reveal which ids exist.
    if (!access) throw new HttpError(404, 'Document not found');
    if (ownerOnly && access !== 'owner') throw new HttpError(403, 'Only the owner can do this');
    return { id: id.data!, access };
  }

  r.get('/', async (req, res) => {
    const documents = await prisma.document.findMany({
      where: { OR: [{ ownerId: req.userId }, { access: { some: { userId: req.userId } } }] },
      select: summary,
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ documents });
  });

  r.post('/', async (req, res) => {
    const { title } = titleBody.partial().parse(req.body ?? {});
    const document = await prisma.document.create({ data: { ownerId: req.userId, title }, select: summary });
    res.status(201).json({ document });
  });

  r.get('/:id', async (req, res) => {
    const { id, access } = await requireDoc(req.userId, req.params.id);
    const document = await prisma.document.findUniqueOrThrow({ where: { id }, select: summary });
    res.json({ document, access });
  });

  r.patch('/:id', async (req, res) => {
    const { id } = await requireDoc(req.userId, req.params.id);
    const { title } = titleBody.parse(req.body);
    const document = await prisma.document.update({ where: { id }, data: { title }, select: summary });
    res.json({ document });
  });

  r.delete('/:id', async (req, res) => {
    const { id } = await requireDoc(req.userId, req.params.id, true);
    await prisma.document.delete({ where: { id } });
    kickRoom(id);
    res.status(204).end();
  });

  r.get('/:id/collaborators', async (req, res) => {
    const { id } = await requireDoc(req.userId, req.params.id);
    const rows = await prisma.documentAccess.findMany({
      where: { documentId: id },
      select: { user: { select: { id: true, name: true, email: true } } },
    });
    res.json({ collaborators: rows.map((r) => r.user) });
  });

  r.post('/:id/collaborators', async (req, res) => {
    const { id } = await requireDoc(req.userId, req.params.id, true);
    const { email } = shareBody.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true } });
    if (!user) throw new HttpError(404, 'No user with that email');
    if (user.id === req.userId) throw new HttpError(400, 'You already own this document');
    await prisma.documentAccess.upsert({
      where: { documentId_userId: { documentId: id, userId: user.id } },
      create: { documentId: id, userId: user.id },
      update: {},
    });
    res.status(201).json({ collaborator: user });
  });

  r.delete('/:id/collaborators/:userId', async (req, res) => {
    const { id } = await requireDoc(req.userId, req.params.id, true);
    await prisma.documentAccess.deleteMany({ where: { documentId: id, userId: req.params.userId } });
    kickRoom(id);
    res.status(204).end();
  });

  return r;
}
