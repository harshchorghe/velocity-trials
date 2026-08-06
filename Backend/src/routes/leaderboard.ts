import { Router } from 'express';
import { getLeaderboard, getStats } from '../game/leaderboardService';

const router = Router();

router.get('/', async (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  res.json({ rows: await getLeaderboard(limit) });
});

router.get('/stats', async (_req, res) => {
  res.json(await getStats());
});

export default router;
