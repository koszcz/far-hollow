// A fire: whether it burns, and how much fuel it holds. A campfire and a fireplace each hold one.
// The rules for fuelling and burning live here, so the two kinds of fire follow the same ones.
// A fireplace burns each piece of fuel twice as long as a campfire, and holds twice as much.
import type { CampfireFuel } from "./wood-and-fuel";

/** What holds a fire: a campfire on the ground or a foundation, or a stone fireplace. */
export type Hearth = "campfire" | "fireplace";

/** A fire. `fuelMinutes` is how many more game minutes its fuel can burn. A lit fire goes out when it reaches 0. */
export interface Fire {
  lit: boolean;
  fuelMinutes: number;
}

/** How many game minutes one of each kind of fuel keeps a campfire burning. Bark burns like sticks. Firewood burns longer. */
export const FUEL_BURN_MINUTES: Readonly<Record<CampfireFuel, number>> = {
  stick: 20,
  bark: 20,
  firewood: 90,
};

/** How many times longer each piece of fuel burns on each hearth than FUEL_BURN_MINUTES says. */
const BURN_TIME_FACTOR: Readonly<Record<Hearth, number>> = { campfire: 1, fireplace: 2 };

/** The most fuel each hearth holds, in game minutes of burning. Fuel that would go past it is not taken. */
export const FUEL_LIMIT_MINUTES: Readonly<Record<Hearth, number>> = { campfire: 8 * 60, fireplace: 16 * 60 };

/** A fire with this little fuel left, in game minutes, counts as out of fuel. */
const FUEL_EMPTY_MINUTES = 1e-6;

/** A new fire with no fuel, not lit. */
export function unlitFire(): Fire {
  return { lit: false, fuelMinutes: 0 };
}

/** How many game minutes one piece of this fuel keeps a fire on this hearth burning. */
export function burnMinutesOf(hearth: Hearth, fuel: CampfireFuel): number {
  return FUEL_BURN_MINUTES[fuel] * BURN_TIME_FACTOR[hearth];
}

/** Whether one more piece of this fuel fits on the fire without going past the hearth's limit. */
export function fuelFits(fire: Fire, hearth: Hearth, fuel: CampfireFuel): boolean {
  return fire.fuelMinutes + burnMinutesOf(hearth, fuel) <= FUEL_LIMIT_MINUTES[hearth];
}

/** The fire with one more piece of this fuel on it. Check `fuelFits` first. */
export function withFuel(fire: Fire, hearth: Hearth, fuel: CampfireFuel): Fire {
  return { ...fire, fuelMinutes: fire.fuelMinutes + burnMinutesOf(hearth, fuel) };
}

/** The fire after it has burnt for this many game minutes. An unlit fire keeps its fuel. A lit one goes out when its fuel runs out. */
export function burnt(fire: Fire, gameMinutes: number): Fire {
  if (!fire.lit) return fire;
  const fuelMinutes = fire.fuelMinutes - gameMinutes;
  // The small allowance stops rounding errors in the clock from leaving a sliver of fuel burning.
  return fuelMinutes > FUEL_EMPTY_MINUTES ? { lit: true, fuelMinutes } : { lit: false, fuelMinutes: 0 };
}

/** How full of fuel the fire is, from 0 (empty) to 1 (its hearth holds no more). */
export function fuelShare(fire: Fire, hearth: Hearth): number {
  return fire.fuelMinutes / FUEL_LIMIT_MINUTES[hearth];
}

/** Whether the fire is out and holds no fuel, so its hearth can come down without losing any. */
export function isColdAndEmpty(fire: Fire): boolean {
  return !fire.lit && fire.fuelMinutes <= 0;
}
