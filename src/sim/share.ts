/**
 * A share: a number from 0 to 1, such as how loud a sound plays, how far rain has eased in, or how far a crossfade has gone.
 * These pure functions own every rule about a share. See ADR 0009.
 */

/** The value held between 0 and 1. */
export function clampShare(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Moves `value` toward `target` by at most `step`, and never past it. */
export function easeToward(value: number, target: number, step: number): number {
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
}

/** Eases a share from 0 to 1 with no sudden start or stop. */
export function smoothStep(share: number): number {
  const clamped = clampShare(share);
  return clamped * clamped * (3 - 2 * clamped);
}

/** How loud two sounds play while one fades into the other, each from 0 to 1. */
export interface Crossfade {
  /** The sound faded from. */
  readonly from: number;
  /** The sound faded to. */
  readonly to: number;
}

/**
 * The two loudnesses `share` of the way through an equal-power crossfade, so the total never dips halfway.
 * The ends are exact, so a sound that should be silent is not left at a tiny loudness by rounding.
 */
export function equalPowerCrossfade(share: number): Crossfade {
  const clamped = clampShare(share);
  const quarterTurn = (clamped * Math.PI) / 2;
  return { from: clamped >= 1 ? 0 : Math.cos(quarterTurn), to: clamped <= 0 ? 0 : Math.sin(quarterTurn) };
}
