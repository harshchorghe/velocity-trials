/**
 * Keyed async mutex.
 *
 * Database constraints are the real guarantee against double-writes, but a lot
 * of game logic is "read current progress, decide, then write". Between the read
 * and the write another concurrent request for the same session could interleave
 * and both could decide the same thing. Serializing per key (usually a session
 * id, or a global key for the qualification cutoff) closes that window.
 */
const tails = new Map<string, Promise<unknown>>();

export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve();

  // A rejected predecessor must not prevent the next waiter from running.
  const run = previous.catch(() => undefined).then(fn);
  const tail = run.catch(() => undefined);
  tails.set(key, tail);

  try {
    return await run;
  } finally {
    // Only the last waiter clears the entry, so the map does not grow forever.
    if (tails.get(key) === tail) tails.delete(key);
  }
}

/** Exposed for tests/diagnostics. */
export function pendingLockCount(): number {
  return tails.size;
}
