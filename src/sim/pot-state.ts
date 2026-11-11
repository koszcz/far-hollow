// What a pot on a campfire holds and how far it has boiled. It imports nothing, so entities and the UI's API can use it.

/** River water in a pot on a lit campfire boils after this many game minutes. One game minute is one real second. */
export const BOIL_MINUTES = 5;

/** What water a pot holds. River water is not safe to drink until it has boiled. */
export type PotWater = "river" | "boiled";

/** A full pot sitting on a campfire. `minutesBoiling` counts the game minutes it has spent on the lit fire. */
export interface PotOnFire {
  water: PotWater;
  minutesBoiling: number;
}

/** How far a pot on a fire is through boiling, from 0 to 1. Boiled water is always 1. */
export function boilProgress(pot: PotOnFire): number {
  return pot.water === "boiled" ? 1 : Math.min(1, pot.minutesBoiling / BOIL_MINUTES);
}
