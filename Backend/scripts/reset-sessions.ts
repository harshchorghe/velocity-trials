import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });
async function main() {
  await prisma.gameSession.deleteMany();
  await prisma.player.deleteMany();
  console.log('All player sessions and progress deleted successfully!');
}
main().finally(() => prisma.$disconnect());
