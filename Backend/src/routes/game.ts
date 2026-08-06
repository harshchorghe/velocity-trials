import { Router } from 'express';
import { assertActive, requireSession, sessionOf } from '../middleware/auth';
import { sessionDto } from '../game/dto';
import {
  registerPlayer,
  reloadSession,
  startSession,
  validateRegistration,
} from '../game/sessionService';
import { getClueBoard, submitSecretCode, verifyClue } from '../game/level1Service';
import {
  collectCrystal,
  getLevel2State,
  registerHazardHit,
  validateCrystalIndex,
} from '../game/level2Service';
import {
  chooseWeapon,
  performBossAction,
  validateBossAction,
  validateSeq,
  validateWeapon,
} from '../game/level3Service';
import { badRequest } from '../lib/errors';

const router = Router();

/** Registration doubles as login: it returns the token used by every other route. */
router.post('/register', async (req, res) => {
  const input = validateRegistration(req.body);
  const player = await registerPlayer(input);
  const session = await startSession(player.id);
  res.status(201).json({ token: session.token, session: sessionDto(session) });
});

router.get('/session', requireSession, async (req, res) => {
  const session = await reloadSession(sessionOf(req).id);
  res.json({ session: sessionDto(session) });
});

/* ── Level 1 ── */

router.get('/level1/clues', requireSession, async (req, res) => {
  const session = sessionOf(req);
  res.json({ clues: await getClueBoard(session.id) });
});

router.post('/level1/clue', requireSession, async (req, res) => {
  const session = sessionOf(req);
  assertActive(session);
  const { clueIndex, code } = (req.body ?? {}) as { clueIndex?: unknown; code?: unknown };
  const index = Number(clueIndex);
  if (!Number.isInteger(index)) throw badRequest('INVALID_CLUE_INDEX', 'clueIndex must be an integer');

  res.json(await verifyClue(session.id, index, code as string));
});

router.post('/level1/code', requireSession, async (req, res) => {
  const session = sessionOf(req);
  assertActive(session);
  const { code } = (req.body ?? {}) as { code?: unknown };
  const result = await submitSecretCode(session.id, code as string);
  res.json({ ...result, session: sessionDto(await reloadSession(session.id)) });
});

/* ── Level 2 ── */

router.get('/level2', requireSession, async (req, res) => {
  res.json(await getLevel2State(sessionOf(req).id));
});

router.post('/level2/crystal', requireSession, async (req, res) => {
  const session = sessionOf(req);
  assertActive(session);
  const { crystalIndex } = (req.body ?? {}) as { crystalIndex?: unknown };
  const result = await collectCrystal(session.id, validateCrystalIndex(crystalIndex));
  res.json({ ...result, session: sessionDto(await reloadSession(session.id)) });
});

router.post('/level2/hazard', requireSession, async (req, res) => {
  const session = sessionOf(req);
  assertActive(session);
  const { hazard } = (req.body ?? {}) as { hazard?: unknown };
  res.json(await registerHazardHit(session.id, typeof hazard === 'string' ? hazard : undefined));
});

/* ── Level 3 ── */

router.post('/level3/weapon', requireSession, async (req, res) => {
  const session = sessionOf(req);
  assertActive(session);
  const { weapon } = (req.body ?? {}) as { weapon?: unknown };
  res.json(await chooseWeapon(session.id, validateWeapon(weapon)));
});

router.post('/level3/action', requireSession, async (req, res) => {
  const session = sessionOf(req);
  assertActive(session);
  const { action, seq } = (req.body ?? {}) as { action?: unknown; seq?: unknown };
  const result = await performBossAction(session.id, validateBossAction(action), validateSeq(seq));
  res.json({ ...result, session: sessionDto(await reloadSession(session.id)) });
});

export default router;
