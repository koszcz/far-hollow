// How big a fire's flames burn, from how much fuel it holds. The drawn flames and the fire's crackle both follow it.
import { FUEL_LIMIT_MINUTES, type FireKind } from "../sim/fire";

/** Flames on a fire with almost no fuel left shrink to this share of their full size. Fuller fires burn bigger. */
const FLAME_SMALLEST_SIZE = 0.35;

/** A lit fire holding this much fuel or more burns at full size, in game minutes: a quarter of its fuel limit. */
export const FLAME_FULL_SIZE_FUEL_MINUTES: Readonly<Record<FireKind, number>> = {
  campfire: FUEL_LIMIT_MINUTES.campfire / 4,
  fireplace: FUEL_LIMIT_MINUTES.fireplace / 4,
};

/**
 * How big a fire's flames are, from 0 (out) to 1 (full size). A lit fire's flames shrink to FLAME_SMALLEST_SIZE as the
 * fuel runs low, so the player can see and hear roughly how much fuel is left.
 */
export function flameSize(kind: FireKind, fire: { readonly lit: boolean; readonly fuelMinutes: number }): number {
  if (!fire.lit) return 0;
  const fullness = Math.min(1, fire.fuelMinutes / FLAME_FULL_SIZE_FUEL_MINUTES[kind]);
  return FLAME_SMALLEST_SIZE + (1 - FLAME_SMALLEST_SIZE) * fullness;
}
