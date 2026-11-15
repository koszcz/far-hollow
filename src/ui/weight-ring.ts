// What a weight ring in the HUD shows: how much of its ring fills with the weight held, and whether it warns that the holder is nearly full.
// The backpack cell at the start of the hotbar and the heading of the open chest or shelf use it.

/** At or above this share of its limit, a weight ring turns to the warning colour and its icon pulses. */
export const NEARLY_FULL = 0.9;

/** The share of the ring that fills at `weight` of `limit`, from 0 (empty) to 1 (full). A weight over the limit stays full. */
export function weightRingShare(weight: number, limit: number): number {
  if (limit <= 0) return 1;
  return Math.min(1, Math.max(0, weight / limit));
}

/** Whether the ring warns at `weight` of `limit`, because the holder is nearly full. */
export function weightRingWarns(weight: number, limit: number): boolean {
  return weight >= limit * NEARLY_FULL;
}
