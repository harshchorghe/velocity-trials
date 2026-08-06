import path from 'path';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import healthRouter from './routes/health';
import gameRouter from './routes/game';
import leaderboardRouter from './routes/leaderboard';
import adminRouter from './routes/admin';
import { GameError } from './lib/errors';

const app = express();

app.use(cors());
app.use(express.json({ limit: '256kb' }));

app.use('/api/health', healthRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/admin', adminRouter);
app.use('/api', gameRouter);

/*
 * Serving the game and the dashboard from this process means one origin for
 * everything, so the browser never has to deal with CORS or a second server.
 * Both paths resolve one level above this file, which holds for `src/` under
 * tsx and `dist/` after a build.
 */
const BACKEND_ROOT = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.resolve(BACKEND_ROOT, '../Frontend');

app.get('/dashboard', (_req, res) => {
  res.sendFile(path.join(BACKEND_ROOT, 'dashboard.html'));
});

app.use(express.static(FRONTEND_DIR));

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Not found' });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof GameError) {
    res.status(err.status).json({ error: err.code, message: err.message, details: err.details });
    return;
  }
  // Unique-constraint failures that reach here are genuine bugs, not user error.
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'INTERNAL', message: 'Internal server error' });
});

export default app;
