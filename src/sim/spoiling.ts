// Fresh food spoiling wherever it is kept: in the backpack, in a chest, on a shelf, in a pile on the ground, and on a drying rack
// until it has dried. A fish in a fish trap or on a fire is not kept in any of these, so it does not spoil.
// The rules for when food spoils live in fresh-food.ts.
import type { BackpackContent } from "./backpack";
import { addCount, holdsNone, takeCount, withoutEmptyKinds, type Counts } from "./counts";
import { type EntityStore } from "./entities";
import { pileEntities } from "./entity-queries";
import {
  NO_SPOIL_TIMES,
  freshnessByFood,
  isFreshFood,
  matchCounts,
  spoiledBy,
  takeOldest,
  withSpoilTimes,
  type Freshness,
  type FreshFood,
  type SpoilTimes,
} from "./fresh-food";
import { hasSpoiled } from "./rack-food";

/** Something that keeps a count per kind and when each fresh food in it spoils: the backpack, or a chest's or shelf's storage. */
export interface FoodHolder {
  contents: Counts<BackpackContent>;
  spoilsAt?: SpoilTimes;
}

/** Matches the holder's spoil times to what it holds at game minute `now`. Food it did not cover yet gets its full keeping time. */
export function matchHolder(holder: FoodHolder, now: number): void {
  const matched = matchCounts(holder.spoilsAt, holder.contents, now);
  // A holder that never held fresh food keeps no spoil times, so its saved shape stays as it was.
  if (matched !== (holder.spoilsAt ?? NO_SPOIL_TIMES)) holder.spoilsAt = matched;
}

/** How fresh the oldest of each fresh food in the holder is at game minute `now`, frozen for a view. It changes nothing. */
export function viewFreshness(holder: FoodHolder, now: number): Readonly<Partial<Record<FreshFood, Freshness>>> {
  const all = freshnessByFood(matchCounts(holder.spoilsAt, holder.contents, now), now);
  for (const freshness of Object.values(all)) Object.freeze(freshness);
  return Object.freeze(all);
}

/**
 * Moves the spoil times of `count` of `content`, oldest first, from one holder to another, at game minute `now`.
 * Call it just before moving the counts themselves. Does nothing for a kind that is not fresh food.
 */
export function moveSpoilTimes(from: FoodHolder, to: FoodHolder, content: BackpackContent, count: number, now: number): void {
  putInHolder(to, content, takeFromHolder(from, content, count, now), now);
}

/**
 * Takes the spoil times of the `count` oldest of `content` out of a holder at game minute `now`, just before its count goes down.
 * Returns none for a kind that is not fresh food.
 */
export function takeFromHolder(holder: FoodHolder, content: BackpackContent, count: number, now: number): readonly number[] {
  if (!isFreshFood(content) || count <= 0) return [];
  matchHolder(holder, now);
  const { left, taken } = takeOldest(holder.spoilsAt, content, count);
  holder.spoilsAt = left;
  return taken;
}

/** Adds the spoil times of foods joining a holder at game minute `now`, just before its count goes up. */
export function putInHolder(holder: FoodHolder, content: BackpackContent, spoilsAt: readonly number[], now: number): void {
  if (!isFreshFood(content) || spoilsAt.length === 0) return;
  matchHolder(holder, now);
  holder.spoilsAt = withSpoilTimes(holder.spoilsAt, content, spoilsAt);
}

/** The counts a pile holds, as a holder of one kind. */
function pileCounts(pile: { content: BackpackContent; count: number }): Counts<BackpackContent> {
  return { [pile.content]: pile.count };
}

/**
 * Takes the spoil times of the `count` oldest foods out of a pile at game minute `now`, just before the pile gives them up.
 * Returns none for a kind that is not fresh food.
 */
export function takeFromPile(pile: { content: BackpackContent; count: number; spoilsAt?: SpoilTimes }, count: number, now: number): readonly number[] {
  if (!isFreshFood(pile.content)) return [];
  const { left, taken } = takeOldest(matchCounts(pile.spoilsAt, pileCounts(pile), now), pile.content, count);
  pile.spoilsAt = left;
  return taken;
}

/** Adds the spoil times of foods joining a pile at game minute `now`, just before its count goes up. */
export function addToPile(pile: { content: BackpackContent; count: number; spoilsAt?: SpoilTimes }, spoilsAt: readonly number[], now: number): void {
  if (!isFreshFood(pile.content) || spoilsAt.length === 0) return;
  pile.spoilsAt = withSpoilTimes(matchCounts(pile.spoilsAt, pileCounts(pile), now), pile.content, spoilsAt);
}

export interface Spoiling {
  /**
   * Matches every holder's spoil times to what it holds at game minute `now`, then takes out every fresh food that has spoiled.
   * A pile left with nothing is removed. Fresh food on a drying rack that has spoiled comes off the rack.
   * Returns how many of each kind spoiled, everywhere together.
   */
  pass(now: number): Counts<FreshFood>;
}

/** Lets fresh food spoil in the backpack, in chests, on shelves, in piles on the ground, and on drying racks. */
export function createSpoiling(entities: EntityStore): Spoiling {
  const backpacks = entities.with("backpack");
  const racks = entities.with("dryingRack");
  const storages = entities.with("storage");
  const piles = pileEntities(entities);

  /** Spoils what has spoiled in one holder, and adds it to `spoiled`. */
  function spoilIn(holder: FoodHolder, now: number, spoiled: Counts<FreshFood>): Counts<FreshFood> {
    matchHolder(holder, now);
    const { left, spoiled: gone } = spoiledBy(holder.spoilsAt, now);
    if (holdsNone(gone)) return spoiled;
    holder.spoilsAt = left;
    let all = spoiled;
    for (const [food, count] of Object.entries(gone) as [FreshFood, number][]) {
      holder.contents = takeCount(holder.contents, food, count);
      all = addCount(all, food, count);
    }
    holder.contents = withoutEmptyKinds(holder.contents);
    return all;
  }

  return {
    pass(now) {
      let spoiled: Counts<FreshFood> = {};
      for (const { backpack } of backpacks) spoiled = spoilIn(backpack, now, spoiled);
      for (const { storage } of storages) spoiled = spoilIn(storage, now, spoiled);
      for (const pile of [...piles]) {
        const { content } = pile.pile;
        if (!isFreshFood(content)) continue;
        const { left, spoiled: gone } = spoiledBy(matchCounts(pile.pile.spoilsAt, pileCounts(pile.pile), now), now);
        if (left !== pile.pile.spoilsAt) pile.pile.spoilsAt = left;
        const count = gone[content] ?? 0;
        if (count === 0) continue;
        spoiled = addCount(spoiled, content, count);
        pile.pile.count -= count;
        if (pile.pile.count <= 0) entities.remove(pile);
      }
      for (const rack of racks) {
        const gone = rack.dryingRack.filter((item) => hasSpoiled(item, now));
        if (gone.length === 0) continue;
        for (const { food } of gone) spoiled = addCount(spoiled, food, 1);
        rack.dryingRack = rack.dryingRack.filter((item) => !gone.includes(item));
      }
      return spoiled;
    },
  };
}
