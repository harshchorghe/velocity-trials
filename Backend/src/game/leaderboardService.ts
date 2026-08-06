import { prisma } from '../db/prisma';
import { GAME_CONFIG } from './constants';

/**
 * Score is derived, never stored, so it can never drift out of sync with the
 * progress rows it summarises.
 */
function computeScore(input: {
  level1Done: boolean;
  level1DurationMs: number | null;
  crystals: number;
  level2Done: boolean;
  bossDamage: number;
  won: boolean;
  champion: boolean;
}): number {
  let score = 0;
  if (input.level1Done) {
    score += 3000;
    // Speed bonus decays over 30 minutes, floored at zero.
    const seconds = Math.floor((input.level1DurationMs ?? 0) / 1000);
    score += Math.max(0, 1800 - seconds);
  }
  score += input.crystals * 500;
  if (input.level2Done) score += 2000;
  score += input.bossDamage * 10;
  if (input.won) score += 3000;
  if (input.champion) score += 5000;
  return score;
}

export interface LeaderboardRow {
  rank: number;
  agent: string;
  department: string;
  year: string;
  rollNumber: string;
  zonesCleared: number;
  totalZones: number;
  crystals: number;
  level1DurationMs: number | null;
  status: string;
  champion: boolean;
  score: number;
}

export async function getLeaderboard(limit = 50): Promise<LeaderboardRow[]> {
  const sessions = await prisma.gameSession.findMany({
    include: { player: true, level1: true, level2: true, level3: true },
  });

  const rows = sessions.map((s) => {
    const level1Done = Boolean(s.level1?.completedAt);
    const level2Done = Boolean(s.level2?.completedAt);
    const crystals = s.level2?.crystalsCollected ?? 0;
    const bossDamage = s.level3 ? GAME_CONFIG.BOSS_MAX_HP - s.level3.bossHp : 0;
    const won = Boolean(s.level3?.won);
    const champion = Boolean(s.level3?.champion);

    return {
      agent: s.player.name,
      department: s.player.department,
      year: s.player.year,
      rollNumber: s.player.rollNumber,
      zonesCleared: (level1Done ? 1 : 0) + (level2Done ? 1 : 0) + (won ? 1 : 0),
      totalZones: 3,
      crystals,
      level1DurationMs: s.level1?.durationMs ?? null,
      status: s.status,
      champion,
      score: computeScore({
        level1Done,
        level1DurationMs: s.level1?.durationMs ?? null,
        crystals,
        level2Done,
        bossDamage,
        won,
        champion,
      }),
    };
  });

  rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Faster Level 1 breaks a score tie; players with no time yet sort last.
    const at = a.level1DurationMs ?? Number.MAX_SAFE_INTEGER;
    const bt = b.level1DurationMs ?? Number.MAX_SAFE_INTEGER;
    return at - bt;
  });

  return rows.slice(0, limit).map((row, i) => ({ rank: i + 1, ...row }));
}

export async function getStats() {
  const [totalPlayers, activeSessions, level1Qualified, level2Qualified, champions] =
    await Promise.all([
      prisma.player.count(),
      prisma.gameSession.count({ where: { status: 'ACTIVE' } }),
      prisma.level1Progress.count({ where: { qualified: true } }),
      prisma.level2Progress.count({ where: { qualified: true } }),
      prisma.level3Progress.count({ where: { champion: true } }),
    ]);

  return {
    totalPlayers,
    activeSessions,
    level1Qualified,
    level1QualifySlots: GAME_CONFIG.LEVEL1_QUALIFY_LIMIT,
    level2Qualified,
    level2QualifySlots: GAME_CONFIG.LEVEL2_QUALIFY_LIMIT,
    champions,
  };
}
