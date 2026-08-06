import http from 'http';
import dotenv from 'dotenv';

dotenv.config();

import app from './app';
import { disconnectDatabase, initDatabase } from './db/prisma';
import { attachGestureSocket } from './ws/gestureSocket';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

const server = http.createServer(app);
attachGestureSocket(server);

async function main() {
  await initDatabase();
  server.listen(PORT, () => {
    console.log(`Velocity Trails API listening on http://localhost:${PORT}`);
    console.log(`Gesture WebSocket listening on ws://localhost:${PORT}/ws/gesture`);
  });
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
  });
}
