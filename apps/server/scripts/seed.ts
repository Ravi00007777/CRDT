// Idempotent demo data: two users sharing one document. `npm run seed`
import { prisma } from '../src/db.js';
import { hashPassword } from '../src/auth/session.js';

const passwordHash = await hashPassword('password123');
const upsertUser = (email: string, name: string) =>
  prisma.user.upsert({ where: { email }, update: {}, create: { email, name, passwordHash } });

const alice = await upsertUser('alice@demo.local', 'Alice');
const bob = await upsertUser('bob@demo.local', 'Bob');

let doc = await prisma.document.findFirst({ where: { ownerId: alice.id, title: 'BTP demo document' } });
doc ??= await prisma.document.create({ data: { ownerId: alice.id, title: 'BTP demo document' } });
await prisma.documentAccess.upsert({
  where: { documentId_userId: { documentId: doc.id, userId: bob.id } },
  update: {},
  create: { documentId: doc.id, userId: bob.id },
});

console.log(`Seeded. Log in as alice@demo.local / bob@demo.local (password123).
Shared doc: http://localhost:5173/d/${doc.id}`);
await prisma.$disconnect();
