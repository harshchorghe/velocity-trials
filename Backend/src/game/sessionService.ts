import crypto from 'crypto';
import { isUniqueViolation, prisma } from '../db/prisma';
import { badRequest, conflict, notFound, unauthorized } from '../lib/errors';
import { withLock } from '../lib/mutex';
import { logEvent } from './audit';
import { SESSION_STATUS } from './constants';
import type { SessionWithProgress } from './dto';

const PROGRESS_INCLUDE = { player: true, level1: true, level2: true, level3: true } as const;

export interface RegistrationInput {
  name: string;
  phone: string;
  rollNumber: string;
  department: string;
  year: string;
}

function requireText(value: unknown, field: string, min = 1): string {
  if (typeof value !== 'string' || value.trim().length < min) {
    throw badRequest('INVALID_FIELD', `${field} is required`);
  }
  return value.trim();
}

export function validateRegistration(body: unknown): RegistrationInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const phoneRaw = requireText(b.phone, 'phone');
  const phone = phoneRaw.replace(/\D/g, '').replace(/^(?:0|91|091)(?=\d{10}$)/, '');
  if (!/^[6-9]\d{9}$/.test(phone)) {
    throw badRequest('INVALID_PHONE', 'Enter a valid 10-digit Indian mobile number');
  }
  return {
    name: requireText(b.name, 'name', 2),
    phone,
    rollNumber: requireText(b.rollNumber, 'rollNumber').toUpperCase(),
    department: requireText(b.department, 'department'),
    year: requireText(b.year, 'year'),
  };
}

/**
 * Registration is keyed on roll number so a player who reloads the portal keeps
 * the same identity instead of creating a duplicate agent.
 */
export async function registerPlayer(input: RegistrationInput) {
  try {
    return await prisma.player.upsert({
      where: { rollNumber: input.rollNumber },
      update: {
        name: input.name,
        phone: input.phone,
        department: input.department,
        year: input.year,
      },
      create: input,
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      // Roll number is free but the phone belongs to a different agent.
      throw conflict('PHONE_TAKEN', 'That phone number is already registered to another agent');
    }
    throw err;
  }
}

/**
 * Returns the player's live session, creating one if they have none.
 *
 * Two concurrent calls cannot both create a session: `activeMarker` is a unique
 * column holding the player id, so the loser of the race gets P2002 and simply
 * reads the winner's session back. The per-player lock keeps that from being the
 * common path, but the constraint is what actually guarantees it.
 */
export async function startSession(playerId: string): Promise<SessionWithProgress> {
  return withLock(`player:${playerId}`, async () => {
    const existing = await prisma.gameSession.findUnique({
      where: { activeMarker: playerId },
      include: PROGRESS_INCLUDE,
    });
    if (existing) return existing;

    try {
      return await prisma.$transaction(async (tx) => {
        const created = await tx.gameSession.create({
          data: {
            playerId,
            token: crypto.randomBytes(24).toString('hex'),
            activeMarker: playerId,
            status: SESSION_STATUS.ACTIVE,
            currentLevel: 1,
            // The Level 1 timer starts the moment the player logs into the portal.
            level1: { create: {} },
          },
          include: PROGRESS_INCLUDE,
        });
        await logEvent(tx, created.id, 'SESSION_START', { playerId });
        return created;
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        const winner = await prisma.gameSession.findUnique({
          where: { activeMarker: playerId },
          include: PROGRESS_INCLUDE,
        });
        if (winner) return winner;
      }
      throw err;
    }
  });
}

export async function getSessionByToken(token: string): Promise<SessionWithProgress> {
  const session = await prisma.gameSession.findUnique({
    where: { token },
    include: PROGRESS_INCLUDE,
  });
  if (!session) throw unauthorized('Session not found — please authenticate again');
  return session;
}

export async function reloadSession(sessionId: string): Promise<SessionWithProgress> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: PROGRESS_INCLUDE,
  });
  if (!session) throw notFound('SESSION_NOT_FOUND', 'Session no longer exists');
  return session;
}

/** Releases the active-session slot so the player can start a fresh run. */
export async function endSession(sessionId: string, status: string) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.gameSession.update({
      where: { id: sessionId },
      data: { status, activeMarker: null, finishedAt: new Date() },
    });
    await logEvent(tx, sessionId, 'SESSION_END', { status });
    return updated;
  });
}
