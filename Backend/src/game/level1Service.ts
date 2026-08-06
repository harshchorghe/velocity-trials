import { isUniqueViolation, prisma } from '../db/prisma';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors';
import { withLock } from '../lib/mutex';
import { logEvent } from './audit';
import { GAME_CONFIG, POWERS, SESSION_STATUS, SETTING_KEYS } from './constants';
import { clueDto } from './dto';

/** Codes are compared case-insensitively with punctuation and spacing ignored. */
function normalizeCode(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function validateCode(raw: unknown, field: string): string {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw badRequest('INVALID_CODE', `${field} is required`);
  }
  const normalized = normalizeCode(raw);
  if (!normalized) throw badRequest('INVALID_CODE', `${field} is required`);
  return normalized;
}

async function requireLevel1(sessionId: string) {
  const l1 = await prisma.level1Progress.findUnique({ where: { sessionId } });
  if (!l1) throw notFound('LEVEL1_NOT_STARTED', 'Level 1 has not been started for this session');
  return l1;
}

/** Clue N is revealed only once clue N-1 has been solved. */
export async function getClueBoard(sessionId: string) {
  const l1 = await requireLevel1(sessionId);
  const clues = await prisma.clue.findMany({ orderBy: { index: 'asc' } });
  const solves = await prisma.clueSolve.findMany({ where: { level1Id: l1.id } });
  const solvedSet = new Set(solves.map((s) => s.clueIndex));

  return clues.map((clue) => clueDto(clue, solvedSet.has(clue.index), clue.index <= l1.solvedCount + 1));
}

export interface ClueResult {
  correct: boolean;
  alreadySolved: boolean;
  solvedCount: number;
  allCluesSolved: boolean;
  nextClueIndex: number | null;
}

/**
 * Validates a clue answer against the server-held code. The client never learns
 * the expected value, which is what makes Level 1 non-trivial to bypass.
 */
export async function verifyClue(sessionId: string, clueIndex: number, rawCode: string): Promise<ClueResult> {
  const code = validateCode(rawCode, 'Clue code');

  return withLock(`session:${sessionId}`, async () =>
    prisma.$transaction(async (tx) => {
      const l1 = await tx.level1Progress.findUnique({ where: { sessionId } });
      if (!l1) throw notFound('LEVEL1_NOT_STARTED', 'Level 1 has not been started');
      if (l1.completedAt) throw conflict('LEVEL1_DONE', 'Level 1 is already complete');

      const clue = await tx.clue.findUnique({ where: { index: clueIndex } });
      if (!clue) throw notFound('CLUE_NOT_FOUND', `Clue ${clueIndex} does not exist`);

      // Clues must be solved in order — the hunt is a chain, not a menu.
      if (clueIndex <= l1.solvedCount) {
        return {
          correct: true,
          alreadySolved: true,
          solvedCount: l1.solvedCount,
          allCluesSolved: l1.solvedCount >= GAME_CONFIG.TOTAL_CLUES,
          nextClueIndex: l1.solvedCount < GAME_CONFIG.TOTAL_CLUES ? l1.solvedCount + 1 : null,
        };
      }
      if (clueIndex !== l1.solvedCount + 1) {
        throw forbidden('CLUE_LOCKED', `Solve clue ${l1.solvedCount + 1} first`);
      }

      await tx.level1Progress.update({
        where: { id: l1.id },
        data: { clueAttempts: { increment: 1 } },
      });

      if (normalizeCode(clue.answerCode) !== code) {
        await logEvent(tx, sessionId, 'CLUE_FAILED', { clueIndex });
        return {
          correct: false,
          alreadySolved: false,
          solvedCount: l1.solvedCount,
          allCluesSolved: false,
          nextClueIndex: clueIndex,
        };
      }

      try {
        await tx.clueSolve.create({ data: { level1Id: l1.id, clueIndex } });
      } catch (err) {
        // Unique([level1Id, clueIndex]) — a duplicate submit lands here and must
        // not bump solvedCount a second time.
        if (isUniqueViolation(err)) {
          return {
            correct: true,
            alreadySolved: true,
            solvedCount: l1.solvedCount,
            allCluesSolved: l1.solvedCount >= GAME_CONFIG.TOTAL_CLUES,
            nextClueIndex: null,
          };
        }
        throw err;
      }

      const updated = await tx.level1Progress.update({
        where: { id: l1.id },
        data: { solvedCount: { increment: 1 } },
      });
      await logEvent(tx, sessionId, 'CLUE_SOLVED', { clueIndex });

      const allSolved = updated.solvedCount >= GAME_CONFIG.TOTAL_CLUES;
      return {
        correct: true,
        alreadySolved: false,
        solvedCount: updated.solvedCount,
        allCluesSolved: allSolved,
        nextClueIndex: allSolved ? null : updated.solvedCount + 1,
      };
    })
  );
}

export interface CodeResult {
  accepted: boolean;
  alreadyCompleted: boolean;
  durationMs: number | null;
  qualified: boolean;
  rank: number | null;
}

/**
 * Final gesture-entered code for Level 1. Only reachable once all three clues
 * are solved; the expected value lives in GameSetting, never in the bundle.
 */
export async function submitSecretCode(sessionId: string, rawCode: string): Promise<CodeResult> {
  const code = validateCode(rawCode, 'Secret code');

  const outcome = await withLock(`session:${sessionId}`, async () =>
    prisma.$transaction(async (tx) => {
      const l1 = await tx.level1Progress.findUnique({ where: { sessionId } });
      if (!l1) throw notFound('LEVEL1_NOT_STARTED', 'Level 1 has not been started');

      if (l1.completedAt) {
        return { accepted: true, alreadyCompleted: true, durationMs: l1.durationMs, l1Id: l1.id };
      }
      if (l1.solvedCount < GAME_CONFIG.TOTAL_CLUES) {
        throw forbidden('CLUES_INCOMPLETE', 'All three clues must be solved before entering the code');
      }

      await tx.level1Progress.update({
        where: { id: l1.id },
        data: { codeAttempts: { increment: 1 } },
      });

      const setting = await tx.gameSetting.findUnique({
        where: { key: SETTING_KEYS.FINAL_SECRET_CODE },
      });
      const expected = normalizeCode(setting?.value ?? '');
      if (!expected || expected !== code) {
        await logEvent(tx, sessionId, 'SECRET_CODE_REJECTED', {});
        return { accepted: false, alreadyCompleted: false, durationMs: null, l1Id: l1.id };
      }

      const completedAt = new Date();
      const durationMs = completedAt.getTime() - l1.startedAt.getTime();
      await tx.level1Progress.update({
        where: { id: l1.id },
        data: { completedAt, durationMs },
      });
      await logEvent(tx, sessionId, 'LEVEL1_COMPLETE', { durationMs });

      return { accepted: true, alreadyCompleted: false, durationMs, l1Id: l1.id };
    })
  );

  if (!outcome.accepted) {
    return { accepted: false, alreadyCompleted: false, durationMs: null, qualified: false, rank: null };
  }

  const qualification = await resolveLevel1Qualification(sessionId, outcome.l1Id);
  return {
    accepted: true,
    alreadyCompleted: outcome.alreadyCompleted,
    durationMs: outcome.durationMs,
    qualified: qualification.qualified,
    rank: qualification.rank,
  };
}

/**
 * "Top performers advance" is implemented as first-N-to-finish. The global lock
 * plus a count inside the transaction means the Nth and N+1th player finishing
 * at the same instant cannot both be admitted.
 */
async function resolveLevel1Qualification(sessionId: string, level1Id: string) {
  return withLock('qualify:level1', async () =>
    prisma.$transaction(async (tx) => {
      const l1 = await tx.level1Progress.findUniqueOrThrow({ where: { id: level1Id } });
      if (l1.rank !== null) return { qualified: l1.qualified, rank: l1.rank };

      // Rank counts everyone who has already finished, so finishers get distinct
      // positions; only the first LEVEL1_QUALIFY_LIMIT of them advance.
      const decided = await tx.level1Progress.count({ where: { rank: { not: null } } });
      const rank = decided + 1;
      const qualified = decided < GAME_CONFIG.LEVEL1_QUALIFY_LIMIT;

      await tx.level1Progress.update({
        where: { id: level1Id },
        data: { qualified, rank },
      });

      if (qualified) {
        await tx.gameSession.update({
          where: { id: sessionId },
          data: { currentLevel: 2 },
        });
        // Powers are assigned by the server so a player cannot pick the easiest one.
        const power = POWERS[Math.floor(Math.random() * POWERS.length)];
        await tx.level2Progress.upsert({
          where: { sessionId },
          update: {},
          create: { sessionId, power, lives: GAME_CONFIG.STARTING_LIVES },
        });
        await logEvent(tx, sessionId, 'LEVEL1_QUALIFIED', { rank, power });
      } else {
        await tx.gameSession.update({
          where: { id: sessionId },
          data: { status: SESSION_STATUS.ELIMINATED, activeMarker: null, finishedAt: new Date() },
        });
        await logEvent(tx, sessionId, 'LEVEL1_ELIMINATED', { rank });
      }

      return { qualified, rank };
    })
  );
}
