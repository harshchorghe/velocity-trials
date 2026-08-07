import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client';
import { SETTING_KEYS } from '../src/game/constants';

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

/*
 * These answer codes are what event staff physically place at each location.
 * They live server-side only — the API never returns `answerCode` to a client.
 */
const CLUES = [
  {
    index: 1,
    text: 'Locate the digital clock tower near the Central Quad. Find the 4-digit relay box code.',
    location: 'hi',
    answerCode: '0000',
  },
  {
    index: 2,
    text: 'Proceed to the Robotics Lab door. Decode the binary matrix posted on the scanner.',
    location: 'Robotics Lab — door scanner',
    answerCode: '0000',
  },
  {
    index: 3,
    text: 'Locate the Velocity Crystal Shrine at the rooftop garden. Note down the Secret Master Code.',
    location: 'Rooftop garden — Velocity Crystal Shrine',
    answerCode: '0000',
  },
];

async function main() {
  for (const clue of CLUES) {
    await prisma.clue.upsert({
      where: { index: clue.index },
      update: { text: clue.text, location: clue.location, answerCode: clue.answerCode },
      create: clue,
    });
  }

  // The 4-digit code entered by hand gesture at the end of Level 1.
  const FINAL_CODE = process.env.FINAL_CODE || '1111'; // Fallback for local testing
  await prisma.gameSetting.upsert({
    where: { key: SETTING_KEYS.FINAL_SECRET_CODE },
    update: { value: FINAL_CODE },
    create: { key: SETTING_KEYS.FINAL_SECRET_CODE, value: FINAL_CODE },
  });

  const clueCount = await prisma.clue.count();
  console.log(`Seeded ${clueCount} clues and the final secret code.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
