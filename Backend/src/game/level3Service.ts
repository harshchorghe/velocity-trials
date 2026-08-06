import { isUniqueViolation, prisma } from '../db/prisma';
import type { Prisma } from '../generated/prisma/client';
import { badRequest, forbidden } from '../lib/errors';
import { withLock } from '../lib/mutex';
import { logEvent } from './audit';
import { GAME_CONFIG, SESSION_STATUS, WEAPONS, WEAPON_STATS, type Weapon } from './constants';
import { endSession } from './sessionService';

const BOSS_ACTIONS = ['attack', 'dodge', 'ultimate'] as const;
export type BossAction = (typeof BOSS_ACTIONS)[number];

export function validateWeapon(raw: unknown): Weapon {
  if (typeof raw !== 'string' || !WEAPONS.includes(raw as Weapon)) {
    throw badRequest('INVALID_WEAPON', `weapon must be one of: ${WEAPONS.join(', ')}`);
  }
  return raw as Weapon;
}

export function validateBossAction(raw: unknown): BossAction {
  if (typeof raw !== 'string' || !BOSS_ACTIONS.includes(raw as BossAction)) {
    throw badRequest('INVALID_ACTION', `action must be one of: ${BOSS_ACTIONS.join(', ')}`);
  }
  return raw as BossAction;
}

export function validateSeq(raw: unknown): number {
  const seq = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(seq) || seq < 0) {
    throw badRequest('INVALID_SEQ', 'seq must be a non-negative integer');
  }
  return seq;
}

async function requireLevel3(tx: Prisma.TransactionClient, sessionId: string) {
  const l3 = await tx.level3Progress.findUnique({ where: { sessionId } });
  if (!l3) throw forbidden('LEVEL3_LOCKED', 'You have not qualified for the final showdown');
  return l3;
}

export async function chooseWeapon(sessionId: string, weapon: Weapon) {
  return withLock(`session:${sessionId}`, async () =>
    prisma.$transaction(async (tx) => {
      const l3 = await requireLevel3(tx, sessionId);
      if (l3.completedAt) throw forbidden('LEVEL3_DONE', 'The battle is already over');
      // Locking the weapon in prevents swapping mid-fight to dodge a bad matchup.
      if (l3.weapon) return { weapon: l3.weapon, alreadyChosen: true };

      await tx.level3Progress.update({
        where: { id: l3.id },
        data: { weapon, startedAt: new Date() },
      });
      await logEvent(tx, sessionId, 'WEAPON_CHOSEN', { weapon });
      return { weapon, alreadyChosen: false };
    })
  );
}

export interface BossActionResult {
  applied: boolean;
  duplicate: boolean;
  action: BossAction;
  damageDealt: number;
  damageTaken: number;
  bossHp: number;
  playerHp: number;
  finished: boolean;
  won: boolean;
  champion: boolean;
}

/**
 * Resolves one combat action.
 *
 * Damage values come from WEAPON_STATS on the server, and `seq` is unique per
 * battle — so a replayed or duplicated request cannot land the same hit twice,
 * which is the difference between a legitimate finisher and a double-tap kill.
 */
export async function performBossAction(
  sessionId: string,
  action: BossAction,
  seq: number
): Promise<BossActionResult> {
  const outcome = await withLock(`session:${sessionId}`, async () =>
    prisma.$transaction(async (tx) => {
      const l3 = await requireLevel3(tx, sessionId);
      if (!l3.weapon) throw forbidden('NO_WEAPON', 'Choose a weapon before fighting');
      if (l3.completedAt) {
        return {
          applied: false,
          duplicate: false,
          damageDealt: 0,
          damageTaken: 0,
          bossHp: l3.bossHp,
          playerHp: l3.playerHp,
          finished: true,
          won: l3.won,
          l3Id: l3.id,
        };
      }

      const now = new Date();
      if (l3.lastActionAt && now.getTime() - l3.lastActionAt.getTime() < GAME_CONFIG.BOSS_ACTION_COOLDOWN_MS) {
        throw badRequest('ACTION_TOO_FAST', 'Slow down — actions are rate limited');
      }

      const stats = WEAPON_STATS[l3.weapon as Weapon];
      const damageDealt =
        action === 'attack' ? stats.attack : action === 'ultimate' ? stats.ultimate : 0;
      // Dodging trades offence for a small heal; anything else lets the boss counter.
      const damageTaken = action === 'dodge' ? 0 : GAME_CONFIG.BOSS_COUNTER_DAMAGE;
      const heal = action === 'dodge' ? GAME_CONFIG.DODGE_HEAL : 0;

      try {
        await tx.bossHit.create({
          data: { level3Id: l3.id, seq, action, damage: damageDealt },
        });
      } catch (err) {
        // Unique([level3Id, seq]) — this exact action was already resolved.
        if (isUniqueViolation(err)) {
          return {
            applied: false,
            duplicate: true,
            damageDealt: 0,
            damageTaken: 0,
            bossHp: l3.bossHp,
            playerHp: l3.playerHp,
            finished: false,
            won: false,
            l3Id: l3.id,
          };
        }
        throw err;
      }

      const bossHp = Math.max(0, l3.bossHp - damageDealt);
      const playerHp = Math.min(
        GAME_CONFIG.PLAYER_MAX_HP,
        Math.max(0, l3.playerHp - damageTaken + heal)
      );
      const finished = bossHp <= 0 || playerHp <= 0;
      const won = bossHp <= 0 && playerHp > 0;

      await tx.level3Progress.update({
        where: { id: l3.id },
        data: {
          bossHp,
          playerHp,
          lastActionAt: now,
          ...(finished
            ? { completedAt: now, durationMs: now.getTime() - l3.startedAt.getTime(), won }
            : {}),
        },
      });
      await logEvent(tx, sessionId, 'BOSS_ACTION', { action, seq, bossHp, playerHp });

      return {
        applied: true,
        duplicate: false,
        damageDealt,
        damageTaken,
        bossHp,
        playerHp,
        finished,
        won,
        l3Id: l3.id,
      };
    })
  );

  let champion = false;
  if (outcome.finished) {
    champion = outcome.won ? await claimChampion(sessionId, outcome.l3Id) : false;
    if (!outcome.won) {
      await endSession(sessionId, SESSION_STATUS.ELIMINATED);
    }
  }

  return {
    applied: outcome.applied,
    duplicate: outcome.duplicate,
    action,
    damageDealt: outcome.damageDealt,
    damageTaken: outcome.damageTaken,
    bossHp: outcome.bossHp,
    playerHp: outcome.playerHp,
    finished: outcome.finished,
    won: outcome.won,
    champion,
  };
}

/**
 * Only the first finalist to fell the Overlord is crowned. Serialized globally
 * so two simultaneous finishing blows cannot both claim the title.
 */
async function claimChampion(sessionId: string, level3Id: string): Promise<boolean> {
  return withLock('claim:champion', async () =>
    prisma.$transaction(async (tx) => {
      const existing = await tx.level3Progress.findUniqueOrThrow({ where: { id: level3Id } });
      if (existing.champion) return true;

      const champions = await tx.level3Progress.count({ where: { champion: true } });
      const isChampion = champions === 0;

      if (isChampion) {
        await tx.level3Progress.update({ where: { id: level3Id }, data: { champion: true } });
        await logEvent(tx, sessionId, 'CHAMPION', {});
      }

      await tx.gameSession.update({
        where: { id: sessionId },
        data: { status: SESSION_STATUS.COMPLETED, activeMarker: null, finishedAt: new Date() },
      });

      return isChampion;
    })
  );
}
