import type { RequestHandler } from 'express';
import { SESSION_COOKIE, verifySession } from '../auth/session.js';
import { HttpError } from './errors.js';

declare module 'express-serve-static-core' {
  interface Request {
    userId: string;
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const userId = verifySession(req.cookies?.[SESSION_COOKIE]);
  if (!userId) return next(new HttpError(401, 'Not authenticated'));
  req.userId = userId;
  next();
};
