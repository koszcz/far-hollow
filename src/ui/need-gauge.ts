// What a need gauge in the HUD shows: how much of its ring fills, and whether it pulses to warn the player.

/** At or below this level a need's gauge pulses, to warn the player. */
export const LOW_NEED = 0.25;

/** The share of a need's ring that fills at `level`, from 0 (empty) to 1 (full). Levels outside that range stay at the nearest end. */
export function needRingShare(level: number): number {
  return Math.min(1, Math.max(0, level));
}

/** Whether a need's gauge pulses at `level`, because the need is low. */
export function needPulses(level: number): boolean {
  return level <= LOW_NEED;
}
