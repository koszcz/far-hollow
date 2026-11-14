// The fish on a campfire and how far each has cooked. It imports nothing, so entities and the UI's API can use it.

/** A raw fish on a lit campfire becomes cooked fish after this many game minutes. One game minute is one real second. */
export const COOK_MINUTES = 8;

/** The most fish one campfire holds at once. They sit beside the pot, so the pot never gets in their way. */
export const FISH_ON_FIRE_LIMIT = 3;

/**
 * One fish on a campfire. `minutesCooked` counts the game minutes it has spent on the lit fire, up to COOK_MINUTES.
 * It keeps its count while the fire is out.
 */
export interface FishOnFire {
  minutesCooked: number;
}

/** How far a fish on a fire is through cooking, from 0 (raw) to 1 (cooked). */
export function cookProgress(fish: FishOnFire): number {
  return Math.min(1, fish.minutesCooked / COOK_MINUTES);
}

/** True once a fish on a fire has cooked. Cooked fish never burn, however long they stay on. */
export function isCooked(fish: FishOnFire): boolean {
  return fish.minutesCooked >= COOK_MINUTES;
}
