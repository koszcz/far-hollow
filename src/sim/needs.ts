// The player's four needs: hunger, thirst, warmth, and fatigue.
import type { Season } from "./season";

/** The four body states the player must keep up. */
export const NEED_KINDS = ["hunger", "thirst", "warmth", "fatigue"] as const;
export type NeedKind = (typeof NEED_KINDS)[number];

/** Each need runs from 0 (empty) to 1 (full). A new game starts with every need full. */
export const FULL_NEED = 1;
/**
 * How much warmth the cold drains per game hour away from a lit fire, in each season, by day and by night.
 * In spring and summer, full warmth lasts a 4-hour night. Autumn nights are colder. Winter drains warmth even by day.
 */
export const WARMTH_DRAIN_PER_HOUR: Readonly<Record<Season, { readonly day: number; readonly night: number }>> = Object.freeze({
  spring: Object.freeze({ day: 0, night: 0.25 }),
  summer: Object.freeze({ day: 0, night: 0.25 }),
  autumn: Object.freeze({ day: 0, night: 0.375 }),
  winter: Object.freeze({ day: 0.1, night: 0.5 }),
});
/** In a snug room, the cold's warmth drain is this share of the usual rate, by day and by night. Rain does not fall indoors, so it does not change. */
export const SNUG_ROOM_DRAIN_SHARE = 1 / 2;
/** How much hunger the player loses per game hour, all day and night. Full hunger lasts two days. */
export const HUNGER_DRAIN_PER_HOUR = 1 / 48;

/** How much warmth the player loses per game hour out in the rain, away from a lit campfire. It adds to the cold's drain. */
export const RAIN_WARMTH_DRAIN_PER_HOUR = 0.25;
/** How much warmth the player gains per game hour within a lit campfire's warmth range. */
export const WARMTH_RECOVERY_PER_HOUR = 1;
/** How much thirst the player loses per game hour, by day and by night. Full thirst lasts one day. */
export const THIRST_DRAIN_PER_HOUR = 1 / 24;
/** While the player is sick, every need drains this many times faster. Needs that recover do so at the usual speed. */
export const SICK_DRAIN_FACTOR = 2;

/** How much fatigue the player loses per game hour while awake and not working. Full fatigue lasts a day awake. */
export const FATIGUE_DRAIN_PER_HOUR = 1 / 24;
/** Timed work, such as chopping or building, drains fatigue this many times faster. */
export const WORK_FATIGUE_FACTOR = 3;
/** How much fatigue the player regains per game hour asleep. A full night's sleep of 8 hours restores it all. */
export const FATIGUE_RECOVERY_PER_HOUR = 1 / 8;
/** Asleep under a roof, the player regains fatigue this many times faster than in the open. */
export const ROOF_SLEEP_FACTOR = 1.5;
/** Asleep in a bed, the player regains fatigue this many times faster than on a bedroll. Under a roof, the roof bonus applies on top. */
export const BED_SLEEP_FACTOR = 2;
/** Sitting on a stool, the player regains fatigue at this share of the rate of sleep in the open. A roof does not change it. */
export const SITTING_REST_SHARE = 1 / 4;

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
  /** The season today, which sets how cold it is. */
  season: Season;
  /** Whether the player stands within a lit campfire's warmth range. */
  warmedByCampfire: boolean;
  /** Whether the player is doing timed work, such as chopping, splitting, or building. */
  working: boolean;
  /** Whether the player is asleep. */
  asleep: boolean;
  /** Whether the player is sick. */
  sick: boolean;
  /** Whether rain falls on the player. Rain does not fall under a roof. Missing means dry. */
  inRain?: boolean;
  /** Whether the player is under a roof, so sleep restores fatigue faster. Missing means in the open. */
  underRoof?: boolean;
  /** Whether the player stands in a snug room, so the cold drains warmth more slowly. Missing means not in one. */
  inSnugRoom?: boolean;
  /** Whether the player sleeps in a bed rather than on a bedroll, so sleep restores fatigue faster. Missing means not in a bed. */
  inBed?: boolean;
  /** Whether the player sits on a stool, awake, so fatigue comes back slowly. Missing means not sitting. */
  sitting?: boolean;
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

/** How much a need changes per game minute in these conditions. Sickness makes a draining need drain faster. */
function needChangePerMinute(kind: NeedKind, conditions: NeedConditions): number {
  const changePerHour = needChangePerHour(kind, conditions);
  const sickFactor = conditions.sick && changePerHour < 0 ? SICK_DRAIN_FACTOR : 1;
  return (changePerHour * sickFactor) / 60;
}

/** How much a need changes per game hour for a player who is not sick. */
function needChangePerHour(kind: NeedKind, conditions: NeedConditions): number {
  switch (kind) {
    case "warmth":
      if (conditions.warmedByCampfire) return WARMTH_RECOVERY_PER_HOUR;
      // Rain chills the player on top of the cold. A snug room keeps out half the cold.
      return -(coldWarmthDrainPerHour(conditions) + (conditions.inRain === true ? RAIN_WARMTH_DRAIN_PER_HOUR : 0));
    case "thirst":
      return -THIRST_DRAIN_PER_HOUR;
    case "hunger":
      return -HUNGER_DRAIN_PER_HOUR;
    case "fatigue":
      if (conditions.asleep) return fatigueRecoveryPerHour(conditions.underRoof === true, conditions.inBed === true);
      if (conditions.sitting === true) return FATIGUE_RECOVERY_PER_HOUR * SITTING_REST_SHARE;
      return -FATIGUE_DRAIN_PER_HOUR * (conditions.working ? WORK_FATIGUE_FACTOR : 1);
  }
}

/** How much warmth the cold drains per game hour away from a fire, by the season and the time of day, and half as much in a snug room. */
function coldWarmthDrainPerHour(conditions: NeedConditions): number {
  const rates = WARMTH_DRAIN_PER_HOUR[conditions.season];
  return (conditions.night ? rates.night : rates.day) * (conditions.inSnugRoom === true ? SNUG_ROOM_DRAIN_SHARE : 1);
}

/** How much fatigue the player regains per game hour asleep, under a roof or in the open, in a bed or on a bedroll. */
function fatigueRecoveryPerHour(underRoof: boolean, inBed: boolean): number {
  return FATIGUE_RECOVERY_PER_HOUR * (underRoof ? ROOF_SLEEP_FACTOR : 1) * (inBed ? BED_SLEEP_FACTOR : 1);
}

/** How many game minutes of sleep restore fatigue fully, under a roof or in the open, in a bed or on a bedroll. */
export function minutesToRestFully(needs: Needs, underRoof = false, inBed = false): number {
  return ((FULL_NEED - needs.fatigue.level) / fatigueRecoveryPerHour(underRoof, inBed)) * 60;
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

/** Fills thirst to full after a drink, which also stops its count toward a collapse. */
export function quenchThirst(needs: Needs): void {
  needs.thirst.level = FULL_NEED;
  needs.thirst.minutesWithout = 0;
}

/** Fills a need by this much, up to full. */
export function fillNeed(needs: Needs, kind: NeedKind, amount: number): void {
  const need = needs[kind];
  need.level = Math.min(FULL_NEED, need.level + amount);
  if (need.level > 0) need.minutesWithout = 0;
}
