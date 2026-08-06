import type { Prisma } from '../generated/prisma/client';

/** Append-only trail of everything that changed a score, for dispute resolution. */
export async function logEvent(
  tx: Prisma.TransactionClient,
  sessionId: string | null,
  type: string,
  payload?: unknown
): Promise<void> {
  await tx.gameEvent.create({
    data: {
      sessionId,
      type,
      payload: payload === undefined ? null : JSON.stringify(payload),
    },
  });
}
