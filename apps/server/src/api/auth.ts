import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { SESSION_COOKIE, cookieOptions, hashPassword, signSession, verifyPassword } from '../auth/session.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { HttpError } from '../middleware/errors.js';

const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});
const registerBody = credentials.extend({ name: z.string().trim().min(1).max(80) });

const publicUser = { id: true, email: true, name: true } as const;

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const { email, password, name } = registerBody.parse(req.body);
  if (await prisma.user.findUnique({ where: { email } })) throw new HttpError(409, 'Email already registered');
  const user = await prisma.user.create({
    data: { email, name, passwordHash: await hashPassword(password) },
    select: publicUser,
  });
  res.cookie(SESSION_COOKIE, signSession(user.id), cookieOptions).status(201).json({ user });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = credentials.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) throw new HttpError(401, 'Invalid email or password');
  res.cookie(SESSION_COOKIE, signSession(user.id), cookieOptions).json({ user: { id: user.id, email: user.email, name: user.name } });
});

authRouter.post('/logout', (_req, res) => {
  const { maxAge: _, ...opts } = cookieOptions;
  res.clearCookie(SESSION_COOKIE, opts).status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: publicUser });
  if (!user) throw new HttpError(401, 'Not authenticated');
  res.json({ user });
});
