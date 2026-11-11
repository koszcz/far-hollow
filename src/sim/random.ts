/** Returns a random number from 0 up to, but not including, 1. */
export type Random = () => number;

/**
 * Makes a random number generator from a seed. The same seed always gives the same numbers.
 * Uses the mulberry32 algorithm, which is small, fast, and good enough for laying out a valley.
 */
export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}
