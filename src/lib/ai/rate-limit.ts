// In-memory per-instance cooldown. Resets on restart and is NOT shared across
// instances — sufficient for a single-node app; use a shared store (e.g.
// Upstash Redis) if this ever runs multi-region.
const lastHit = new Map<string, number>();
const MAX_ENTRIES = 1000;

/**
 * Returns an error message when the same scope:key called again within
 * `minIntervalMs`, otherwise null and the call is recorded.
 */
export function enforceCooldown(
  scope: string,
  key: string,
  minIntervalMs = 2000
): string | null {
  const now = Date.now();
  const id = `${scope}:${key}`;
  const previous = lastHit.get(id);

  if (previous && now - previous < minIntervalMs) {
    return "You're going a bit fast — wait a moment and try again.";
  }

  lastHit.set(id, now);

  if (lastHit.size > MAX_ENTRIES) {
    for (const [entry, at] of lastHit) {
      if (now - at > 60_000) lastHit.delete(entry);
    }
  }

  return null;
}
