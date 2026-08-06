/**
 * Concurrency harness.
 *
 * Every scenario below fires genuinely simultaneous requests at a live server
 * and then asserts on the persisted rows. These are the cases where a naive
 * "read progress, decide, write progress" implementation silently corrupts
 * state: duplicate crystal counts, negative lives, over-filled qualification
 * brackets, double-applied finishing blows.
 *
 * Run with: npm run test:race
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const TEST_DB = path.resolve(__dirname, '../prisma/race-test.db');
process.env.DATABASE_URL = `file:${TEST_DB}`;

for (const suffix of ['', '-journal', '-wal', '-shm']) {
  fs.rmSync(`${TEST_DB}${suffix}`, { force: true });
}

execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
  cwd: path.resolve(__dirname, '..'),
  env: { ...process.env, DATABASE_URL: `file:${TEST_DB}` },
  stdio: 'pipe',
});

let passed = 0;
const failures: string[] = [];

async function scenario(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push(name);
    console.log(`  ✗ ${name}\n      ${(err as Error).message.split('\n')[0]}`);
  }
}

async function main() {
  const { prisma, initDatabase, disconnectDatabase } = await import('../src/db/prisma');
  const { default: app } = await import('../src/app');
  const { GAME_CONFIG, SETTING_KEYS } = await import('../src/game/constants');

  await initDatabase();

  const CLUE_CODES = ['7412', '3391', '5820'];
  const SECRET = '2026';
  for (let i = 0; i < CLUE_CODES.length; i++) {
    await prisma.clue.upsert({
      where: { index: i + 1 },
      update: { answerCode: CLUE_CODES[i] },
      create: { index: i + 1, text: `Clue ${i + 1}`, answerCode: CLUE_CODES[i] },
    });
  }
  await prisma.gameSetting.upsert({
    where: { key: SETTING_KEYS.FINAL_SECRET_CODE },
    update: { value: SECRET },
    create: { key: SETTING_KEYS.FINAL_SECRET_CODE, value: SECRET },
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;

  const post = (p: string, body: unknown, token?: string) =>
    fetch(`${base}${p}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

  let agentSeq = 0;
  async function register() {
    const i = agentSeq++;
    const res = await post('/api/register', {
      name: `Agent ${i}`,
      phone: `9${String(100000000 + i)}`,
      rollNumber: `RACE${i}`,
      department: 'CSE',
      year: 'BE',
    });
    const json = (await res.json()) as { token: string; session: { sessionId: string } };
    return { token: json.token, sessionId: json.session.sessionId };
  }

  async function solveAllClues(token: string) {
    for (let i = 0; i < CLUE_CODES.length; i++) {
      await post('/api/level1/clue', { clueIndex: i + 1, code: CLUE_CODES[i] }, token);
    }
  }

  console.log('\nRace-condition scenarios\n');

  /* 1 — Two simultaneous logins for the same agent must share one session. */
  await scenario('concurrent register for one agent yields a single active session', async () => {
    const payload = {
      name: 'Duplicate Agent',
      phone: '9990001111',
      rollNumber: 'DUPE1',
      department: 'IT',
      year: 'TY',
    };
    const results = await Promise.all(
      Array.from({ length: 12 }, () => post('/api/register', payload))
    );
    const bodies = (await Promise.all(results.map((r) => r.json()))) as {
      session: { sessionId: string };
    }[];
    const ids = new Set(bodies.map((b) => b.session.sessionId));
    assert.equal(ids.size, 1, `expected 1 session id, got ${ids.size}`);

    const player = await prisma.player.findUniqueOrThrow({ where: { rollNumber: 'DUPE1' } });
    const active = await prisma.gameSession.count({
      where: { playerId: player.id, status: 'ACTIVE' },
    });
    assert.equal(active, 1, `expected 1 ACTIVE session, got ${active}`);
  });

  /* 2 — Hammering the same clue must credit it exactly once. */
  await scenario('concurrent duplicate clue submits credit the clue once', async () => {
    const { token, sessionId } = await register();
    await Promise.all(
      Array.from({ length: 15 }, () =>
        post('/api/level1/clue', { clueIndex: 1, code: CLUE_CODES[0] }, token)
      )
    );
    const l1 = await prisma.level1Progress.findUniqueOrThrow({ where: { sessionId } });
    assert.equal(l1.solvedCount, 1, `solvedCount should be 1, got ${l1.solvedCount}`);
    const solves = await prisma.clueSolve.count({ where: { level1Id: l1.id } });
    assert.equal(solves, 1, `expected 1 ClueSolve row, got ${solves}`);
  });

  /* 3 — The Level 1 bracket must not overfill when everyone finishes at once. */
  const qualifiedTokens: string[] = [];
  await scenario(
    `simultaneous Level 1 finishes fill exactly ${GAME_CONFIG.LEVEL1_QUALIFY_LIMIT} slots`,
    async () => {
      const contenders = await Promise.all(
        Array.from({ length: GAME_CONFIG.LEVEL1_QUALIFY_LIMIT + 6 }, () => register())
      );
      await Promise.all(contenders.map((c) => solveAllClues(c.token)));

      // The actual race: every finalist submits the winning code in the same tick.
      const responses = await Promise.all(
        contenders.map((c) => post('/api/level1/code', { code: SECRET }, c.token))
      );
      const bodies = (await Promise.all(responses.map((r) => r.json()))) as {
        accepted: boolean;
        qualified: boolean;
      }[];

      // Captured before the assertions so a failure here cannot starve later scenarios.
      contenders.forEach((c, i) => {
        if (bodies[i].qualified) qualifiedTokens.push(c.token);
      });

      const qualifiedCount = await prisma.level1Progress.count({ where: { qualified: true } });
      assert.equal(
        qualifiedCount,
        GAME_CONFIG.LEVEL1_QUALIFY_LIMIT,
        `expected exactly ${GAME_CONFIG.LEVEL1_QUALIFY_LIMIT} qualified, got ${qualifiedCount}`
      );
      assert.ok(
        bodies.every((b) => b.accepted),
        'every correct code should be accepted'
      );

      const ranks = await prisma.level1Progress.findMany({
        where: { rank: { not: null } },
        select: { rank: true },
      });
      const rankValues = ranks.map((r) => r.rank!);
      assert.equal(
        new Set(rankValues).size,
        rankValues.length,
        'ranks must be unique — a duplicate means two writers read the same count'
      );
      assert.equal(qualifiedTokens.length, GAME_CONFIG.LEVEL1_QUALIFY_LIMIT);
    }
  );

  /* 4 — The same crystal reported many times must bank once. */
  await scenario('concurrent duplicate crystal collection banks one crystal', async () => {
    const token = qualifiedTokens[0];
    const sessionRes = await fetch(`${base}/api/session`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const { session } = (await sessionRes.json()) as { session: { sessionId: string } };

    await Promise.all(
      Array.from({ length: 20 }, () => post('/api/level2/crystal', { crystalIndex: 0 }, token))
    );

    const l2 = await prisma.level2Progress.findUniqueOrThrow({
      where: { sessionId: session.sessionId },
    });
    assert.equal(l2.crystalsCollected, 1, `expected 1 crystal, got ${l2.crystalsCollected}`);
    const rows = await prisma.crystalCollect.count({ where: { level2Id: l2.id } });
    assert.equal(rows, 1, `expected 1 CrystalCollect row, got ${rows}`);
  });

  /* 5 — Lives must never underflow past zero under concurrent hazard hits. */
  await scenario('concurrent hazard hits never drive lives negative', async () => {
    const token = qualifiedTokens[1];
    const sessionRes = await fetch(`${base}/api/session`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const { session } = (await sessionRes.json()) as { session: { sessionId: string } };

    for (let round = 0; round < 5; round++) {
      await Promise.all(
        Array.from({ length: 10 }, () => post('/api/level2/hazard', { hazard: 'robot' }, token))
      );
      await new Promise((r) => setTimeout(r, 750)); // clear the anti-spam cooldown
    }

    const l2 = await prisma.level2Progress.findUniqueOrThrow({
      where: { sessionId: session.sessionId },
    });
    assert.ok(l2.lives >= 0, `lives went negative: ${l2.lives}`);
    assert.ok(
      l2.lives <= GAME_CONFIG.STARTING_LIVES,
      `lives exceeded the maximum: ${l2.lives}`
    );
    if (l2.lives === 0) assert.equal(l2.failed, true, 'a player at 0 lives must be marked failed');
  });

  /* 6 — Only two finalists, even if several finish together. */
  const finalistTokens: string[] = [];
  await scenario(
    `simultaneous Level 2 finishes fill exactly ${GAME_CONFIG.LEVEL2_QUALIFY_LIMIT} slots`,
    async () => {
      // Everyone still alive collects two crystals, then races for the third.
      const alive: string[] = [];
      for (const token of qualifiedTokens.slice(2)) {
        const state = await fetch(`${base}/api/level2`, {
          headers: { authorization: `Bearer ${token}` },
        }).then((r) => r.json() as Promise<{ failed: boolean }>);
        if (!state.failed) alive.push(token);
      }
      assert.ok(alive.length >= 4, `need at least 4 live contenders, have ${alive.length}`);

      for (const token of alive) {
        await post('/api/level2/crystal', { crystalIndex: 0 }, token);
        await post('/api/level2/crystal', { crystalIndex: 1 }, token);
      }

      const responses = await Promise.all(
        alive.map((token) => post('/api/level2/crystal', { crystalIndex: 2 }, token))
      );
      const bodies = (await Promise.all(responses.map((r) => r.json()))) as {
        completed: boolean;
        qualified: boolean;
      }[];

      alive.forEach((token, i) => {
        if (bodies[i].qualified) finalistTokens.push(token);
      });

      const qualifiedCount = await prisma.level2Progress.count({ where: { qualified: true } });
      assert.equal(
        qualifiedCount,
        GAME_CONFIG.LEVEL2_QUALIFY_LIMIT,
        `expected exactly ${GAME_CONFIG.LEVEL2_QUALIFY_LIMIT} finalists, got ${qualifiedCount}`
      );
      assert.equal(finalistTokens.length, GAME_CONFIG.LEVEL2_QUALIFY_LIMIT);
    }
  );

  /* 7 — A replayed attack must not land twice. */
  await scenario('replayed boss action with the same seq applies damage once', async () => {
    const token = finalistTokens[0];
    await post('/api/level3/weapon', { weapon: 'sword' }, token);

    const sessionRes = await fetch(`${base}/api/session`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const { session } = (await sessionRes.json()) as { session: { sessionId: string } };

    const before = await prisma.level3Progress.findUniqueOrThrow({
      where: { sessionId: session.sessionId },
    });

    await Promise.all(
      Array.from({ length: 12 }, () => post('/api/level3/action', { action: 'attack', seq: 1 }, token))
    );

    const after = await prisma.level3Progress.findUniqueOrThrow({
      where: { sessionId: session.sessionId },
    });
    const hits = await prisma.bossHit.count({ where: { level3Id: after.id, seq: 1 } });
    assert.equal(hits, 1, `expected 1 recorded hit for seq=1, got ${hits}`);

    const damage = before.bossHp - after.bossHp;
    assert.equal(damage, 20, `sword should deal exactly 20 once, dealt ${damage}`);
  });

  /* 8 — Exactly one champion, no matter how the finishing blows interleave. */
  await scenario('only one champion is crowned', async () => {
    await Promise.all(
      finalistTokens.map(async (token) => {
        await post('/api/level3/weapon', { weapon: 'blaster' }, token);
        for (let seq = 100; seq < 120; seq++) {
          const res = await post('/api/level3/action', { action: 'ultimate', seq }, token);
          const body = (await res.json()) as { finished?: boolean };
          if (body.finished) break;
          await new Promise((r) => setTimeout(r, GAME_CONFIG.BOSS_ACTION_COOLDOWN_MS + 50));
        }
      })
    );

    const champions = await prisma.level3Progress.count({ where: { champion: true } });
    assert.equal(champions, 1, `expected exactly 1 champion, got ${champions}`);
  });

  /* 9 — Server-side answers: a wrong code must never advance progress. */
  await scenario('wrong codes are rejected and do not advance progress', async () => {
    const { token, sessionId } = await register();
    const bad = await post('/api/level1/clue', { clueIndex: 1, code: '0000' }, token);
    const badBody = (await bad.json()) as { correct: boolean };
    assert.equal(badBody.correct, false, 'a wrong clue code must be rejected');

    const l1 = await prisma.level1Progress.findUniqueOrThrow({ where: { sessionId } });
    assert.equal(l1.solvedCount, 0, 'a rejected clue must not advance solvedCount');

    // And the final code is unreachable until every clue is genuinely solved.
    const early = await post('/api/level1/code', { code: SECRET }, token);
    assert.equal(early.status, 403, `expected 403 before clues are solved, got ${early.status}`);
  });

  await new Promise<void>((resolve) => server.close(() => resolve()));
  await disconnectDatabase();

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log(`Failed: ${failures.join(', ')}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
