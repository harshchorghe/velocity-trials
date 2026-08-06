import type { NextFunction, Request, Response } from 'express';
import type { SessionWithProgress } from '../game/dto';
import { getSessionByToken } from '../game/sessionService';
import { forbidden, unauthorized } from '../lib/errors';

export function extractToken(req: Request): string | null {
  const header = req.header('authorization');
  if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  const custom = req.header('x-session-token');
  return custom?.trim() || null;
}

export async function requireSession(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) throw unauthorized();
    req.gameSession = await getSessionByToken(token);
    next();
  } catch (err) {
    next(err);
  }
}

/** Narrows the optional request field after requireSession has run. */
export function sessionOf(req: Request): SessionWithProgress {
  if (!req.gameSession) throw unauthorized();
  return req.gameSession;
}

export function assertActive(session: SessionWithProgress) {
  if (session.status !== 'ACTIVE') {
    throw forbidden('SESSION_INACTIVE', `This session is ${session.status.toLowerCase()}`);
  }
}
