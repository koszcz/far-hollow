// How long a lit torch still burns, in the hand or planted, and every rule about it. See docs/adr/0009.
// The game saves it as it is, so its shape is part of the save.

/** How long a lit torch burns, in game minutes: 3 game hours. */
export const TORCH_BURN_MINUTES = 180;

/** How long a lit torch still burns. */
export interface BurnTime {
  /** How many more game minutes the torch burns. Always above 0: a torch with no minutes left is gone. */
  readonly minutesLeft: number;
}

/** The burn time of a torch just lit: TORCH_BURN_MINUTES. */
export function freshBurnTime(): BurnTime {
  return { minutesLeft: TORCH_BURN_MINUTES };
}

/** The burn time left after `minutes` more game minutes, or undefined if the torch has burnt out by then. */
export function burnDown(time: BurnTime, minutes: number): BurnTime | undefined {
  const minutesLeft = time.minutesLeft - minutes;
  return minutesLeft > 0 ? { minutesLeft } : undefined;
}

/** How much of its whole burning time the torch has left, from 1 (just lit) to 0 (burnt out). */
export function burnShare(time: BurnTime): number {
  return Math.max(0, Math.min(1, time.minutesLeft / TORCH_BURN_MINUTES));
}
