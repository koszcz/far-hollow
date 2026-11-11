// The player's four needs: hunger, thirst, warmth, and fatigue. Only hunger and warmth change for now.

/** The four body states the player must keep up. */
export const NEED_KINDS = ["hunger", "thirst", "warmth", "fatigue"] as const;
export type NeedKind = (typeof NEED_KINDS)[number];

/** Each need runs from 0 (empty) to 1 (full). A new game starts with every need full. */
export const FULL_NEED = 1;
/** How much warmth the player loses per game hour at night, away from a lit campfire. Full warmth lasts 4 hours. */
export const WARMTH_DRAIN_PER_HOUR = 0.25;
/** How much hunger the player loses per game hour, all day and night. Full hunger lasts two days. */
export const HUNGER_DRAIN_PER_HOUR = 1 / 48;
/** How much warmth the player gains per game hour within a lit campfire's warmth range. */
export const WARMTH_RECOVERY_PER_HOUR = 1;

/** Below this level, a need makes the player move and work more slowly. */
export const LOW_NEED = 0.3;
/** With a need empty, the player moves and works at this fraction of their normal speed. */
const SLOWEST_SPEED = 0.4;

/** The player has a collapse after any one need stays empty for this many game minutes in a row. */
export const COLLAPSE_AFTER_MINUTES = 60;
/** The player wakes from a collapse with each need at least this full. It is low enough to slow them. */
export const NEED_AFTER_COLLAPSE = 0.15;

export interface NeedState {
  /** From 0 (empty) to 1 (full). */
  level: number;
  /** How many game minutes in a row this need has been empty. */
  minutesWithout: number;
}

export type Needs = Record<NeedKind, NeedState>;

export function createNeeds(): Needs {
  return {
    hunger: { level: FULL_NEED, minutesWithout: 0 },
    thirst: { level: FULL_NEED, minutesWithout: 0 },
    warmth: { level: FULL_NEED, minutesWithout: 0 },
    fatigue: { level: FULL_NEED, minutesWithout: 0 },
  };
}

export interface NeedConditions {
  /** Whether it is night. */
  night: boolean;
  /** Whether the player stands within a lit campfire's warmth range. */
  warmedByCampfire: boolean;
}

/** Changes every need for this many game minutes spent in these conditions. */
export function passNeedsTime(needs: Needs, gameMinutes: number, conditions: NeedConditions): void {
  for (const kind of NEED_KINDS) {
    const need = needs[kind];
    const wasEmpty = need.level <= 0;
    need.level = Math.min(FULL_NEED, Math.max(0, need.level + needChangePerMinute(kind, conditions) * gameMinutes));
    if (need.level > 0) need.minutesWithout = 0;
    // Count only the time spent empty, not the slice in which the need ran out.
    else if (wasEmpty) need.minutesWithout += gameMinutes;
  }
}

/** How much a need changes per game minute in these conditions. Thirst and fatigue hold steady for now. */
function needChangePerMinute(kind: NeedKind, conditions: NeedConditions): number {
  if (kind === "hunger") return -HUNGER_DRAIN_PER_HOUR / 60;
  if (kind !== "warmth") return 0;
  if (conditions.warmedByCampfire) return WARMTH_RECOVERY_PER_HOUR / 60;
  if (conditions.night) return -WARMTH_DRAIN_PER_HOUR / 60;
  return 0;
}

/** Whether any one need has been empty for too long, so the player has a collapse. */
export function hasCollapsed(needs: Needs): boolean {
  return NEED_KINDS.some((kind) => needs[kind].minutesWithout >= COLLAPSE_AFTER_MINUTES);
}

/** Sets the needs to what the player has when they wake from a collapse. Needs fuller than that stay as they are. */
export function wakeFromCollapse(needs: Needs): void {
  for (const kind of NEED_KINDS) {
    needs[kind].level = Math.max(needs[kind].level, NEED_AFTER_COLLAPSE);
    needs[kind].minutesWithout = 0;
  }
}

/**
 * How fast the player moves and works with these needs, as a fraction of their normal speed.
 * The lowest need decides. Above low, it is 1. Below, it falls steadily to its slowest when the need is empty.
 */
export function needsSpeed(needs: Needs): number {
  const lowest = Math.min(...NEED_KINDS.map((kind) => needs[kind].level));
  if (lowest >= LOW_NEED) return 1;
  return SLOWEST_SPEED + (1 - SLOWEST_SPEED) * (lowest / LOW_NEED);
}

/** Fills a need by this much, up to full. */
export function fillNeed(needs: Needs, kind: NeedKind, amount: number): void {
  const need = needs[kind];
  need.level = Math.min(FULL_NEED, need.level + amount);
  if (need.level > 0) need.minutesWithout = 0;
}
