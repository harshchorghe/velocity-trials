import { isUniqueViolation, prisma } from '../db/prisma';
import type { Prisma } from '../generated/prisma/client';
import { badRequest, forbidden } from '../lib/errors';
import { withLock } from '../lib/mutex';
import { logEvent } from './audit';
import { GAME_CONFIG, SESSION_STATUS } from './constants';

/** Hazard damage is throttled server-side so a spamming client cannot drain its own lives. */
const HAZARD_COOLDOWN_MS = 700;

export function validateCrystalIndex(raw: unknown): number {
  const index = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(index) || index < 0 || index >= GAME_CONFIG.TOTAL_CRYSTALS) {
    throw badRequest('INVALID_CRYSTAL', `crystalIndex must be 0..${GAME_CONFIG.TOTAL_CRYSTALS - 1}`);
  }
  return index;
}

async function requirePlayableLevel2(tx: Prisma.TransactionClient, sessionId: string) {
  const l2 = await tx.level2Progress.findUnique({ where: { sessionId } });
  if (!l2) throw forbidden('LEVEL2_LOCKED', 'You have not qualified for Level 2');
  return l2;
}

export async function getLevel2State(sessionId: string) {
  const l2 = await prisma.level2Progress.findUnique({
    where: { sessionId },
    include: { crystals: true },
  });
  if (!l2) throw forbidden('LEVEL2_LOCKED', 'You have not qualified for Level 2');
  return {
    power: l2.power,
    lives: l2.lives,
    crystalsCollected: l2.crystalsCollected,
    collectedIndexes: l2.crystals.map((c) => c.crystalIndex).sort((a, b) => a - b),
    totalCrystals: GAME_CONFIG.TOTAL_CRYSTALS,
    completedAt: l2.completedAt,
    durationMs: l2.durationMs,
    qualified: l2.qualified,
    failed: l2.failed,
    rank: l2.rank,
  };
}

export interface CrystalResult {
  collected: boolean;
  alreadyCollected: boolean;
  crystalsCollected: number;
  lives: number;
  completed: boolean;
  qualified: boolean;
  rank: number | null;
}

/**
 * Banks one crystal.
 *
 * The unique index on (level2Id, crystalIndex) is what makes this safe: if the
 * client fires the same collection twice — double click, retry, lag spike, or
 * two racing requests — the second insert violates the constraint and we return
 * the existing state instead of incrementing the counter again.
 */
export async function collectCrystal(sessionId: string, crystalIndex: number): Promise<CrystalResult> {
  const outcome = await withLock(`session:${sessionId}`, async () =>
    prisma.$transaction(async (tx) => {
      const l2 = await requirePlayableLevel2(tx, sessionId);
      if (l2.failed) throw forbidden('LEVEL2_FAILED', 'You are out of lives');
      if (l2.completedAt) {
        return {
          alreadyCollected: true,
          crystalsCollected: l2.crystalsCollected,
          lives: l2.lives,
          completed: true,
          l2Id: l2.id,
        };
      }

      try {
        await tx.crystalCollect.create({ data: { level2Id: l2.id, crystalIndex } });
      } catch (err) {
        if (isUniqueViolation(err)) {
          return {
            alreadyCollected: true,
            crystalsCollected: l2.crystalsCollected,
            lives: l2.lives,
            completed: false,
            l2Id: l2.id,
          };
        }
        throw err;
      }

      const updated = await tx.level2Progress.update({
        where: { id: l2.id },
        data: { crystalsCollected: { increment: 1 } },
      });
      await logEvent(tx, sessionId, 'CRYSTAL_COLLECTED', { crystalIndex });

      const completed = updated.crystalsCollected >= GAME_CONFIG.TOTAL_CRYSTALS;
      if (completed) {
        const completedAt = new Date();
        await tx.level2Progress.update({
          where: { id: l2.id },
          data: {
            completedAt,
            durationMs: completedAt.getTime() - updated.startedAt.getTime(),
          },
        });
        await logEvent(tx, sessionId, 'LEVEL2_COMPLETE', {});
      }

      return {
        alreadyCollected: false,
        crystalsCollected: updated.crystalsCollected,
        lives: updated.lives,
        completed,
        l2Id: l2.id,
      };
    })
  );

  let qualified = false;
  let rank: number | null = null;
  if (outcome.completed) {
    const q = await resolveLevel2Qualification(sessionId, outcome.l2Id);
    qualified = q.qualified;
    rank = q.rank;
  }

  return {
    collected: !outcome.alreadyCollected,
    alreadyCollected: outcome.alreadyCollected,
    crystalsCollected: outcome.crystalsCollected,
    lives: outcome.lives,
    completed: outcome.completed,
    qualified,
    rank,
  };
}

export interface HazardResult {
  applied: boolean;
  lives: number;
  failed: boolean;
}

/**
 * Applies one hazard hit.
 *
 * The decrement is a single guarded statement — `lives: { gt: 0 }` in the WHERE
 * means the database itself refuses to take lives below zero, so two concurrent
 * hits on a player with one life left can only ever remove that one life.
 */
export async function registerHazardHit(sessionId: string, hazard?: string): Promise<HazardResult> {
  return withLock(`session:${sessionId}`, async () =>
    prisma.$transaction(async (tx) => {
      const l2 = await requirePlayableLevel2(tx, sessionId);
      if (l2.completedAt || l2.failed) {
        return { applied: false, lives: l2.lives, failed: l2.failed };
      }

      const now = new Date();
      if (l2.lastHitAt && now.getTime() - l2.lastHitAt.getTime() < HAZARD_COOLDOWN_MS) {
        return { applied: false, lives: l2.lives, failed: false };
      }

      const guarded = await tx.level2Progress.updateMany({
        where: { id: l2.id, lives: { gt: 0 }, completedAt: null, failed: false },
        data: { lives: { decrement: 1 }, lastHitAt: now },
      });
      if (guarded.count === 0) {
        const current = await tx.level2Progress.findUniqueOrThrow({ where: { id: l2.id } });
        return { applied: false, lives: current.lives, failed: current.failed };
      }

      const after = await tx.level2Progress.findUniqueOrThrow({ where: { id: l2.id } });
      await logEvent(tx, sessionId, 'HAZARD_HIT', { hazard: hazard ?? null, lives: after.lives });

      if (after.lives <= 0) {
        await tx.level2Progress.update({ where: { id: l2.id }, data: { failed: true } });
        await tx.gameSession.update({
          where: { id: sessionId },
          data: { status: SESSION_STATUS.ELIMINATED, activeMarker: null, finishedAt: now },
        });
        await logEvent(tx, sessionId, 'LEVEL2_FAILED', {});
        return { applied: true, lives: 0, failed: true };
      }

      return { applied: true, lives: after.lives, failed: false };
    })
  );
}

/** First two players to bank all three crystals advance to the final. */
async function resolveLevel2Qualification(sessionId: string, level2Id: string) {
  return withLock('qualify:level2', async () =>
    prisma.$transaction(async (tx) => {
      const l2 = await tx.level2Progress.findUniqueOrThrow({ where: { id: level2Id } });
      if (l2.rank !== null) return { qualified: l2.qualified, rank: l2.rank };

      // Distinct finishing position for everyone; only the first two advance.
      const decided = await tx.level2Progress.count({ where: { rank: { not: null } } });
      const rank = decided + 1;
      const qualified = decided < GAME_CONFIG.LEVEL2_QUALIFY_LIMIT;

      await tx.level2Progress.update({ where: { id: level2Id }, data: { qualified, rank } });

      if (qualified) {
        await tx.gameSession.update({ where: { id: sessionId }, data: { currentLevel: 3 } });
        await tx.level3Progress.upsert({
          where: { sessionId },
          update: {},
          create: {
            sessionId,
            bossHp: GAME_CONFIG.BOSS_MAX_HP,
            playerHp: GAME_CONFIG.PLAYER_MAX_HP,
          },
        });
        await logEvent(tx, sessionId, 'LEVEL2_QUALIFIED', { rank });
      } else {
        await tx.gameSession.update({
          where: { id: sessionId },
          data: { status: SESSION_STATUS.ELIMINATED, activeMarker: null, finishedAt: new Date() },
        });
        await logEvent(tx, sessionId, 'LEVEL2_ELIMINATED', { rank });
      }

      return { qualified, rank };
    })
  );
}
