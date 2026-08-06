import type {
  Clue,
  GameSession,
  Level1Progress,
  Level2Progress,
  Level3Progress,
  Player,
} from '../generated/prisma/client';
import { GAME_CONFIG } from './constants';

/**
 * Client-facing shapes. Kept explicit (rather than returning Prisma rows) so a
 * schema field can never leak by accident — in particular `Clue.answerCode`
 * and the final secret code must never cross the wire.
 */

export function playerDto(player: Player) {
  return {
    id: player.id,
    name: player.name,
    rollNumber: player.rollNumber,
    department: player.department,
    year: player.year,
  };
}

export function clueDto(clue: Clue, solved: boolean, unlocked: boolean) {
  return {
    index: clue.index,
    // A locked clue's text is withheld so players cannot read ahead.
    text: unlocked ? clue.text : null,
    location: unlocked ? clue.location : null,
    solved,
    unlocked,
  };
}

export function level1Dto(l1: Level1Progress | null) {
  if (!l1) return null;
  return {
    startedAt: l1.startedAt,
    completedAt: l1.completedAt,
    durationMs: l1.durationMs,
    solvedCount: l1.solvedCount,
    totalClues: GAME_CONFIG.TOTAL_CLUES,
    clueAttempts: l1.clueAttempts,
    codeAttempts: l1.codeAttempts,
    qualified: l1.qualified,
    rank: l1.rank,
  };
}

export function level2Dto(l2: Level2Progress | null) {
  if (!l2) return null;
  return {
    power: l2.power,
    lives: l2.lives,
    crystalsCollected: l2.crystalsCollected,
    totalCrystals: GAME_CONFIG.TOTAL_CRYSTALS,
    startedAt: l2.startedAt,
    completedAt: l2.completedAt,
    durationMs: l2.durationMs,
    qualified: l2.qualified,
    failed: l2.failed,
    rank: l2.rank,
  };
}

export function level3Dto(l3: Level3Progress | null) {
  if (!l3) return null;
  return {
    weapon: l3.weapon,
    bossHp: l3.bossHp,
    playerHp: l3.playerHp,
    bossMaxHp: GAME_CONFIG.BOSS_MAX_HP,
    playerMaxHp: GAME_CONFIG.PLAYER_MAX_HP,
    startedAt: l3.startedAt,
    completedAt: l3.completedAt,
    durationMs: l3.durationMs,
    won: l3.won,
    champion: l3.champion,
  };
}

export type SessionWithProgress = GameSession & {
  player?: Player;
  level1?: Level1Progress | null;
  level2?: Level2Progress | null;
  level3?: Level3Progress | null;
};

export function sessionDto(session: SessionWithProgress) {
  return {
    sessionId: session.id,
    status: session.status,
    currentLevel: session.currentLevel,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    player: session.player ? playerDto(session.player) : undefined,
    level1: level1Dto(session.level1 ?? null),
    level2: level2Dto(session.level2 ?? null),
    level3: level3Dto(session.level3 ?? null),
  };
}
