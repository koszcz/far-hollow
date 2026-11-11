// The player's warmth: the only need in the first playable.

/** Warmth runs from 0 (frozen) to 1 (fully warm). A new game starts fully warm. */
export const FULL_WARMTH = 1;
/** How much warmth the player loses per game hour at night, away from a lit campfire. Full warmth lasts 4 hours. */
export const WARMTH_DRAIN_PER_HOUR = 0.25;

/** How much warmth the player gains per game hour within a lit campfire's warmth range. */
export const WARMTH_RECOVERY_PER_HOUR = 1;

/** Below this much warmth, the player moves and works more slowly. */
export const LOW_WARMTH = 0.3;
/** At no warmth at all, the player moves and works at this fraction of their normal speed. */
const SLOWEST_SPEED = 0.4;

/** The player has a collapse after this many game minutes in a row with no warmth at all. */
export const COLLAPSE_AFTER_MINUTES = 60;
/** The player wakes from a collapse with this much warmth, which is low enough to slow them. */
export const WARMTH_AFTER_COLLAPSE = 0.15;

export interface WarmthState {
  /** From 0 (frozen) to 1 (fully warm). */
  level: number;
  /** How many game minutes in a row the player has had no warmth at all. */
  minutesWithout: number;
}

export function createWarmth(): WarmthState {
  return { level: FULL_WARMTH, minutesWithout: 0 };
}

export interface WarmthConditions {
  /** Whether it is night. */
  night: boolean;
  /** Whether the player stands within a lit campfire's warmth range. */
  warmedByCampfire: boolean;
}

/** Changes warmth for this many game minutes spent in these conditions. */
export function passWarmthTime(warmth: WarmthState, gameMinutes: number, conditions: WarmthConditions): void {
  const wasWithout = warmth.level <= 0;
  if (conditions.warmedByCampfire) {
    warmth.level = Math.min(FULL_WARMTH, warmth.level + (WARMTH_RECOVERY_PER_HOUR * gameMinutes) / 60);
  } else if (conditions.night) {
    warmth.level = Math.max(0, warmth.level - (WARMTH_DRAIN_PER_HOUR * gameMinutes) / 60);
  }
  if (warmth.level > 0) warmth.minutesWithout = 0;
  // Count only the time spent with no warmth, not the slice in which it ran out.
  else if (wasWithout) warmth.minutesWithout += gameMinutes;
}

/** Whether the player has gone without warmth for too long, and has a collapse. */
export function hasCollapsed(warmth: WarmthState): boolean {
  return warmth.minutesWithout >= COLLAPSE_AFTER_MINUTES;
}

/** Sets warmth to what the player has when they wake from a collapse. */
export function wakeFromCollapse(warmth: WarmthState): void {
  warmth.level = WARMTH_AFTER_COLLAPSE;
  warmth.minutesWithout = 0;
}

/**
 * How fast the player moves and works at this much warmth, as a fraction of their normal speed.
 * Above low warmth it is 1. Below, it falls steadily to its slowest at no warmth.
 */
export function warmthSpeed(warmth: WarmthState): number {
  if (warmth.level >= LOW_WARMTH) return 1;
  return SLOWEST_SPEED + (1 - SLOWEST_SPEED) * (warmth.level / LOW_WARMTH);
}
