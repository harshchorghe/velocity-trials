import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client';

const url = process.env.DATABASE_URL ?? 'file:./dev.db';

/*
 * `timeout` is better-sqlite3's busy timeout: when a write lock is held, other
 * writers wait rather than immediately failing with SQLITE_BUSY. Combined with
 * WAL mode below this lets concurrent requests queue instead of erroring, which
 * matters because every scoring write in this game is a write transaction.
 */
const adapter = new PrismaBetterSqlite3({ url, timeout: 5000 });

export const prisma = new PrismaClient({ adapter });

let pragmasApplied = false;

/** WAL lets readers run while a writer holds the lock — required for the live leaderboard. */
export async function initDatabase(): Promise<void> {
  if (pragmasApplied) return;
  await prisma.$executeRawUnsafe('PRAGMA journal_mode = WAL');
  await prisma.$executeRawUnsafe('PRAGMA busy_timeout = 5000');
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');
  pragmasApplied = true;
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

/** True when an error is Prisma's unique-constraint violation (P2002). */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}
