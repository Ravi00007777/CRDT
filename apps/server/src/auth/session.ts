import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { parse } from 'cookie';
import type { CookieOptions } from 'express';
import { cookieSecure, env } from '../config/env.js';

export const SESSION_COOKIE = 'ss_session';
const MAX_AGE_S = 7 * 24 * 3600;

export const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: cookieSecure,
  path: '/',
  maxAge: MAX_AGE_S * 1000,
};

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export function signSession(userId: string) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: MAX_AGE_S, algorithm: 'HS256' });
}

/** Returns the user id for a valid token, otherwise null. */
export function verifySession(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    return typeof payload === 'object' && typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export function userIdFromCookieHeader(header: string | null | undefined) {
  return verifySession(header ? parse(header)[SESSION_COOKIE] : undefined);
}
