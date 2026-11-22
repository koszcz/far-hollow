// The jug on a campfire or fireplace and how far it has fired. It imports nothing, so entities and the UI's API can use it.

/** An unfired jug on a lit campfire or fireplace becomes a jug after this many game minutes. One game minute is one real second. */
export const FIRE_JUG_MINUTES = 20;

/**
 * The jug on a campfire or fireplace. A fire holds one at a time. `minutesFired` counts the game minutes it has spent on the
 * lit fire, up to FIRE_JUG_MINUTES. It keeps its count while the fire is out.
 */
export interface JugOnFire {
  minutesFired: number;
}

/** How far a jug on a fire is through firing, from 0 (unfired) to 1 (fired). */
export function fireProgress(jug: JugOnFire): number {
  return Math.min(1, jug.minutesFired / FIRE_JUG_MINUTES);
}

/** True once a jug on a fire has fired. A fired jug never breaks, however long it stays on. */
export function isFired(jug: JugOnFire): boolean {
  return jug.minutesFired >= FIRE_JUG_MINUTES;
}
