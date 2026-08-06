import crypto from 'crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { prisma } from '../db/prisma';
import { GAME_CONFIG } from '../game/constants';
import { getLeaderboard, getStats } from '../game/leaderboardService';
import { badRequest, unauthorized } from '../lib/errors';

const router = Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/** In-memory admin sessions — fine for a single-process event server. */
const adminTokens = new Map<string, number>();

function timingSafeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // timingSafeEqual throws on length mismatch, so compare lengths separately.
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function pruneExpired() {
  const now = Date.now();
  for (const [token, expiry] of adminTokens) {
    if (expiry <= now) adminTokens.delete(token);
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  pruneExpired();
  const header = req.header('authorization');
  const token = header?.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : null;
  if (!token || !adminTokens.has(token)) {
    next(unauthorized('Admin authentication required'));
    return;
  }
  next();
}

/**
 * The password is checked here, not in the browser. The previous dashboard
 * shipped its password in client-side JS, so anyone could read it from source.
 */
router.post('/login', (req, res) => {
  if (!ADMIN_PASSWORD) {
    throw badRequest('ADMIN_DISABLED', 'ADMIN_PASSWORD is not configured on the server');
  }
  const { password } = (req.body ?? {}) as { password?: unknown };
  if (typeof password !== 'string' || !timingSafeEquals(password, ADMIN_PASSWORD)) {
    throw unauthorized('Incorrect admin password');
  }

  const token = crypto.randomBytes(32).toString('hex');
  adminTokens.set(token, Date.now() + SESSION_TTL_MS);
  res.json({ token, expiresInMs: SESSION_TTL_MS });
});

router.post('/logout', requireAdmin, (req, res) => {
  const token = req.header('authorization')?.slice(7).trim();
  if (token) adminTokens.delete(token);
  res.json({ ok: true });
});

/** Full registration detail, including phone numbers — admin-only for that reason. */
router.get('/agents', requireAdmin, async (_req, res) => {
  const sessions = await prisma.gameSession.findMany({
    include: { player: true, level1: true, level2: true, level3: true },
    orderBy: { startedAt: 'desc' },
  });

  const board = await getLeaderboard(500);
  const scoreByRoll = new Map(board.map((row) => [row.rollNumber, row]));

  const agents = sessions.map((s) => {
    const row = scoreByRoll.get(s.player.rollNumber);
    return {
      name: s.player.name,
      roll: s.player.rollNumber,
      dept: s.player.department,
      year: s.player.year,
      phone: s.player.phone,
      registeredAt: s.player.createdAt,
      status: s.status,
      currentLevel: s.currentLevel,
      level1Qualified: s.level1?.qualified ?? false,
      level1DurationMs: s.level1?.durationMs ?? null,
      crystals: s.level2?.crystalsCollected ?? 0,
      lives: s.level2?.lives ?? null,
      level2Qualified: s.level2?.qualified ?? false,
      bossHp: s.level3?.bossHp ?? null,
      champion: s.level3?.champion ?? false,
      zonesCleared: row?.zonesCleared ?? 0,
      score: row?.score ?? 0,
    };
  });

  res.json({ agents, stats: await getStats(), config: GAME_CONFIG });
});

export default router;
