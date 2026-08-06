import type { SessionWithProgress } from '../game/dto';

declare global {
  namespace Express {
    interface Request {
      gameSession?: SessionWithProgress;
    }
  }
}

export {};
