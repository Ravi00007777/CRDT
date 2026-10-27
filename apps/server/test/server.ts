// Spawns the real server against the test database so tests can kill/restart it.
import { spawn, type ChildProcess } from 'node:child_process';
import { execSync } from 'node:child_process';

export const PORT = 4100;
const env = {
  ...process.env,
  PORT: String(PORT),
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? `postgresql://${process.env.USER}@localhost:5432/syncspace_test`,
  JWT_SECRET: 'test-secret-test-secret-test-secret-123',
  WEB_ORIGIN: 'http://localhost:5173',
};
process.env.SYNCSPACE_URL = `http://localhost:${PORT}`;

export function migrateTestDb() {
  execSync('npx prisma migrate deploy', { env, stdio: 'ignore' });
}

export async function startServer(): Promise<ChildProcess> {
  const child = spawn('npx', ['tsx', 'src/index.ts'], { env, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise<void>((resolve, reject) => {
    child.stdout!.on('data', (b) => String(b).includes('SyncSpace server') && resolve());
    child.on('exit', (code) => reject(new Error(`server exited ${code}`)));
  });
  return child;
}

export function stopServer(child: ChildProcess) {
  return new Promise<void>((resolve) => {
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
  });
}
