// Sickness: a temporary state that makes the player's needs drain faster. It wears off over one day.

/** Sickness wears off after this many game minutes for a player who keeps busy. */
export const SICKNESS_MINUTES = 24 * 60;
/** While the player rests, sickness wears off this many times faster. */
export const RESTING_RECOVERY_FACTOR = 2;

export interface Sickness {
  /** How many more game minutes the sickness lasts for a player who keeps busy. */
  minutesLeft: number;
}

/** A new sickness, lasting a full day. Catching it again while sick starts it over. */
export function catchSickness(): Sickness {
  return { minutesLeft: SICKNESS_MINUTES };
}

/** Wears the sickness off for this many game minutes. Returns true once it has worn off completely. */
export function passSicknessTime(sickness: Sickness, gameMinutes: number, { resting }: { resting: boolean }): boolean {
  const factor = resting ? RESTING_RECOVERY_FACTOR : 1;
  sickness.minutesLeft = Math.max(0, sickness.minutesLeft - gameMinutes * factor);
  return sickness.minutesLeft <= 0;
}
