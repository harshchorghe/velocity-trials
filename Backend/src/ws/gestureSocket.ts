import type { Server as HttpServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { GestureSession } from '../gesture/session';
import { ClientMessage, Landmark, LandmarksMessage } from '../gesture/types';
import { GAME_CONFIG } from '../game/constants';
import { submitSecretCode } from '../game/level1Service';
import { getSessionByToken } from '../game/sessionService';
import { GameError } from '../lib/errors';
import { withLock } from '../lib/mutex';

const MAX_HANDS = 2;

function isValidLandmarks(value: unknown): value is Landmark[] {
  if (!Array.isArray(value)) return false;
  if (value.length !== 0 && value.length !== 21) return false;
  return value.every(
    (pt) =>
      pt &&
      typeof pt === 'object' &&
      typeof (pt as Landmark).x === 'number' &&
      typeof (pt as Landmark).y === 'number' &&
      typeof (pt as Landmark).z === 'number'
  );
}

/** Normalizes both the two-hand payload and the legacy single-hand one. */
function readHands(msg: LandmarksMessage): Landmark[][] | null {
  if (Array.isArray(msg.hands)) {
    if (msg.hands.length > MAX_HANDS) return null;
    if (!msg.hands.every((h) => Array.isArray(h) && h.length === 21 && isValidLandmarks(h))) {
      return null;
    }
    return msg.hands;
  }
  if (msg.landmarks !== undefined) {
    if (!isValidLandmarks(msg.landmarks)) return null;
    return msg.landmarks.length ? [msg.landmarks] : [];
  }
  return null;
}

function isClientMessage(value: unknown): value is ClientMessage {
  if (!value || typeof value !== 'object') return false;
  const type = (value as { type?: unknown }).type;
  if (type === 'clear') return true;
  return type === 'landmarks' && readHands(value as LandmarksMessage) !== null;
}

/**
 * `/ws/gesture` — streams MediaPipe hand landmarks up, classification down.
 *
 * The socket also owns the Level 1 code entry: confirmed digits accumulate into
 * a server-side buffer and are submitted through the same validated service the
 * REST route uses, so a player cannot fabricate a code by editing the page.
 */
export function attachGestureSocket(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws/gesture' });
  let connectionSeq = 0;

  wss.on('connection', async (socket: WebSocket, req) => {
    const connectionId = `ws:${++connectionSeq}`;
    const gestures = new GestureSession();
    let entered: number[] = [];

    const send = (payload: unknown) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
    };

    // A token is optional: without one the pad still classifies gestures, it just
    // cannot bank a code. That keeps the level playable if auth ever hiccups.
    let sessionId: string | null = null;
    try {
      const url = new URL(req.url ?? '', 'http://localhost');
      const token = url.searchParams.get('token');
      if (token) sessionId = (await getSessionByToken(token)).id;
    } catch {
      sessionId = null;
    }
    send({ type: 'ready', authenticated: sessionId !== null, slots: GAME_CONFIG.SECRET_CODE_LENGTH });

    const submitIfComplete = async () => {
      if (entered.length < GAME_CONFIG.SECRET_CODE_LENGTH) return;
      const code = entered.join('');
      entered = [];
      if (!sessionId) {
        send({ type: 'codeResult', accepted: false, reason: 'NOT_AUTHENTICATED' });
        return;
      }
      try {
        const result = await submitSecretCode(sessionId, code);
        send({ type: 'codeResult', ...result });
      } catch (err) {
        send({
          type: 'codeResult',
          accepted: false,
          reason: err instanceof GameError ? err.code : 'ERROR',
          message: err instanceof Error ? err.message : 'Submission failed',
        });
      }
      send({ type: 'code', digits: entered });
    };

    socket.on('message', (raw) => {
      let msg: unknown;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!isClientMessage(msg)) return;

      // Frames arrive faster than an async submit resolves, so every message for
      // this connection is serialized — otherwise two frames could both push a
      // digit into a buffer that is mid-submit.
      void withLock(connectionId, async () => {
        if ((msg as { type: string }).type === 'clear') {
          entered = [];
          send({ type: 'code', digits: entered });
          return;
        }

        const hands = readHands(msg as LandmarksMessage);
        if (hands === null) return;

        const { preview, confirmed } = gestures.processHands(hands);
        send(preview);

        if (confirmed) {
          send(confirmed);
          if (entered.length < GAME_CONFIG.SECRET_CODE_LENGTH) {
            entered.push(confirmed.digit);
            send({ type: 'code', digits: entered });
          }
          await submitIfComplete();
        }
      });
    });
  });

  return wss;
}
