import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { authRouter } from './api/auth.js';
import { documentsRouter, type KickRoom } from './api/documents.js';
import { errorHandler } from './middleware/errors.js';
import { env } from './config/env.js';

export function createApp(kickRoom: KickRoom) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());

  // The web app is served same-origin (Vite proxy in dev). Reject cross-site state changes.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (req.method !== 'GET' && origin && origin !== env.WEB_ORIGIN) return res.status(403).json({ error: 'Bad origin' });
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);
  app.use('/api/documents', documentsRouter(kickRoom));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // Production: serve the built web app from the same origin (dev uses the Vite proxy instead).
  const webDist = path.resolve(import.meta.dirname, '../../web/dist');
  if (existsSync(webDist)) {
    app.use(express.static(webDist, { index: false, maxAge: '1h' }));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  }
  app.use(errorHandler);
  return app;
}
