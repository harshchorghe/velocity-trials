/**
 * Prints the answer codes event staff need to place at each physical location.
 * These live only in the database and are never sent to a browser.
 *
 * Run with: npm run codes
 */
import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { SETTING_KEYS } from '../src/game/constants';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./dev.db' }),
});

async function main() {
  const clues = await prisma.clue.findMany({ orderBy: { index: 'asc' } });
  const secret = await prisma.gameSetting.findUnique({
    where: { key: SETTING_KEYS.FINAL_SECRET_CODE },
  });

  console.log('\n  VELOCITY TRIALS — STAFF CODE SHEET');
  console.log('  ' + '─'.repeat(58));
  for (const clue of clues) {
    console.log(`  CLUE ${clue.index}   code: ${clue.answerCode}`);
    console.log(`           place at: ${clue.location ?? '—'}`);
    console.log(`           ${clue.text}`);
    console.log('');
  }
  console.log(`  FINAL SECRET CODE (entered by hand gesture): ${secret?.value ?? '(not set)'}`);
  console.log('  ' + '─'.repeat(58));
  console.log('  Edit these in prisma/seed.ts, then run: npm run seed\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
