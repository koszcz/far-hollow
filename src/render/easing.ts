// Easing curves that the code-posed player motions share. Each takes a share of the way, from 0 to 1, and gives back
// how far the motion has gone, also from 0 to 1, so it starts and stops smoothly.

/** The value `t` of the way from `a` to `b`. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Speeds up through the first half and slows down through the second, with no speed at either end. */
export const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** A gentler S-curve than easeInOut, with no speed at either end. */
export const smoothstep = (t: number): number => t * t * (3 - 2 * t);
