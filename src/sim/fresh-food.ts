/**
 * Fresh food and when it spoils: berries, mushrooms, raw fish, and cooked fish (see GLOSSARY.md).
 * A holder, such as the backpack, a chest, a shelf, or a pile, keeps one count per food kind. Its spoil times say, for each
 * fresh food kind, the game minute at which each of those foods spoils, soonest first. The soonest is the oldest.
 * Food stays fully fresh until it spoils, so nothing else changes as it ages.
 * Each function returns a new value. The caller assigns it back to the component. See ADR 0009.
 */
import type { BackpackContent } from "./backpack";
import { countOf, type Counts } from "./counts";

/** Food that spoils. Preserved food, which never spoils, is not fresh food. */
export type FreshFood = "berries" | "mushroom" | "rawFish" | "cookedFish";

/** Every fresh food kind, in a steady order. */
export const FRESH_FOODS: readonly FreshFood[] = ["berries", "mushroom", "rawFish", "cookedFish"];

/** How long each fresh food keeps, in game minutes, from when it was gathered, caught, or cooked. */
export const KEEPS_FOR_MINUTES: Readonly<Record<FreshFood, number>> = {
  rawFish: 1 * 24 * 60,
  cookedFish: 2 * 24 * 60,
  berries: 2 * 24 * 60,
  mushroom: 3 * 24 * 60,
};

/** The game minute each fresh food a holder holds spoils at, per kind, soonest first. A kind that is missing has none. */
export type SpoilTimes = Readonly<Partial<Record<FreshFood, readonly number[]>>>;

/** Spoil times that hold no food. */
export const NO_SPOIL_TIMES: SpoilTimes = Object.freeze({});

/** True if `content` is a fresh food, which spoils. */
export function isFreshFood(content: BackpackContent): content is FreshFood {
  return (FRESH_FOODS as readonly string[]).includes(content);
}

/** The spoil times of `food`, soonest first. */
function timesOf(times: SpoilTimes | undefined, food: FreshFood): readonly number[] {
  return times?.[food] ?? [];
}

/** The spoil times with `food`'s list set to `list`, which must be soonest first. An empty list drops the kind. */
function withList(times: SpoilTimes | undefined, food: FreshFood, list: readonly number[]): SpoilTimes {
  const { [food]: _dropped, ...rest } = times ?? {};
  return list.length === 0 ? rest : { ...rest, [food]: list };
}

/**
 * The spoil times matched to how many of each fresh food `counts` holds, at game minute `now`.
 * A food the times do not know about yet, such as one just gathered, caught, or cooked, gets its full keeping time from now.
 * A food the counts no longer hold, such as one eaten, is the oldest one, so its time goes first.
 * Returns `times` itself when they already match.
 */
export function matchCounts(times: SpoilTimes | undefined, counts: Counts<BackpackContent>, now: number): SpoilTimes {
  let matched = times ?? NO_SPOIL_TIMES;
  for (const food of FRESH_FOODS) {
    const list = timesOf(matched, food);
    const count = countOf(counts, food);
    if (list.length === count) continue;
    matched =
      list.length > count
        ? withList(matched, food, list.slice(list.length - count))
        : withSpoilTimes(matched, food, new Array<number>(count - list.length).fill(now + KEEPS_FOR_MINUTES[food]));
  }
  return matched;
}

/** Takes the `count` oldest of `food` from the spoil times: what is left, and the spoil times taken, soonest first. */
export function takeOldest(times: SpoilTimes | undefined, food: FreshFood, count: number): { left: SpoilTimes; taken: readonly number[] } {
  const list = timesOf(times, food);
  const cut = Math.max(0, Math.min(count, list.length));
  return { left: withList(times, food, list.slice(cut)), taken: list.slice(0, cut) };
}

/** The spoil times with `added` spoil times of `food` among them, kept soonest first. */
export function withSpoilTimes(times: SpoilTimes | undefined, food: FreshFood, added: readonly number[]): SpoilTimes {
  if (added.length === 0) return times ?? NO_SPOIL_TIMES;
  return withList(
    times,
    food,
    [...timesOf(times, food), ...added].sort((a, b) => a - b),
  );
}

/**
 * Splits off every food that has spoiled by game minute `now`: the spoil times left, and how many of each kind spoiled.
 * Returns `times` itself, and no counts, when nothing has spoiled.
 */
export function spoiledBy(times: SpoilTimes | undefined, now: number): { left: SpoilTimes; spoiled: Counts<FreshFood> } {
  let left = times ?? NO_SPOIL_TIMES;
  const spoiled: Partial<Record<FreshFood, number>> = {};
  for (const food of FRESH_FOODS) {
    const list = timesOf(left, food);
    const gone = list.findIndex((spoilsAt) => spoilsAt > now);
    const count = gone === -1 ? list.length : gone;
    if (count === 0) continue;
    spoiled[food] = count;
    left = withList(left, food, list.slice(count));
  }
  return { left, spoiled };
}

/** How long the oldest of `food` has left before it spoils, and that as a share of its whole keeping time. */
export interface Freshness {
  /** Game minutes until the oldest one spoils. */
  readonly minutesLeft: number;
  /** The share of its keeping time the oldest one has left, from 0 (about to spoil) to 1 (just gathered). */
  readonly share: number;
}

/** How fresh the oldest of `food` is at game minute `now`, or undefined if the spoil times hold none of it. */
export function freshnessOf(times: SpoilTimes | undefined, food: FreshFood, now: number): Freshness | undefined {
  const oldest = timesOf(times, food)[0];
  if (oldest === undefined) return undefined;
  const minutesLeft = Math.max(0, oldest - now);
  return { minutesLeft, share: Math.min(1, minutesLeft / KEEPS_FOR_MINUTES[food]) };
}

/** How fresh the oldest of each fresh food is at game minute `now`. A kind the spoil times hold none of is missing. */
export function freshnessByFood(times: SpoilTimes | undefined, now: number): Readonly<Partial<Record<FreshFood, Freshness>>> {
  const all: Partial<Record<FreshFood, Freshness>> = {};
  for (const food of FRESH_FOODS) {
    const freshness = freshnessOf(times, food, now);
    if (freshness !== undefined) all[food] = freshness;
  }
  return all;
}
