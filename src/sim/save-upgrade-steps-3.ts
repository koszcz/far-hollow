// The save upgrades from version 42 to the newest version, one function for each version.
import type { Entity } from "./entities";
import type { GroundPoint } from "./ground-point";
import { generateValley } from "./valley";
import { nothingToUpgrade } from "./save-upgrade-helpers";

/** Version 42 to 43: the player can lay floors on foundations. A save from before then has none, so it carries over unchanged. */
export function addFloors(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/** Version 43 to 44: the player can hang doors in door frames. A save from before then has none, so it carries over unchanged. */
export function addDoors(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/** Version 44 to 45: the game saves whether the snug-room banner has shown. A save from before then has not shown it. */
export function recordSnugRoomNotice(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return { ...save, snugRoomNoticeShown: false };
}

/** Version 45 to 46: the player can dig up saplings into the backpack. A save from before then holds none, so it carries over unchanged. */
export function addSaplings(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/** Version 46 to 47: the player can plant saplings. A save from before then holds no planted sapling and no planting under way, so it carries over unchanged. */
export function addPlanting(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/**
 * Version 47 to 48: the player can plant a mushroom on a log. A save from before then holds no mushroom log and no planting
 * of one under way, so it carries over unchanged.
 */
export function addMushroomLogs(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/** Version 48 to 49: the player can build rain barrels. A save from before then holds none, so it carries over unchanged. */
export function addRainBarrels(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/**
 * Version 49 to 50: the player can dig up and plant berry bushes as well as saplings. Digging up under way names what it digs up
 * as `thingId`, not `saplingId`, and planting under way says what it plants. In an older save, both can only be a sapling.
 */
export function plantBerryBushes(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  if (!Array.isArray(save.entities)) return { ...save };
  const entities: unknown[] = save.entities.map((entity: unknown) => {
    const components = (entity as { components?: Record<string, unknown> | null } | null)?.components;
    if (typeof components !== "object" || components === null) return entity;
    const { digUpTask, plantTask } = components;
    if (digUpTask === undefined && plantTask === undefined) return entity;
    const upgraded: Record<string, unknown> = { ...components };
    if (typeof digUpTask === "object" && digUpTask !== null) {
      const { saplingId, ...rest } = digUpTask as Record<string, unknown>;
      upgraded.digUpTask = { ...rest, thingId: saplingId };
    }
    if (typeof plantTask === "object" && plantTask !== null) upgraded.plantTask = { ...plantTask, plant: "sapling" };
    return { ...(entity as object), components: upgraded };
  });
  return { ...save, entities };
}

/**
 * Version 50 to 51: the refusal for a blueprint over a mushroom log is renamed from `coversMushroomLog` to `mushroomLogInTheWay`,
 * to match `berryBushInTheWay`. A notice may still show it.
 */
export function renameMushroomLogRefusal(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const notice = save.notice as { refusal?: { kind?: unknown } } | null | undefined;
  if (notice?.refusal?.kind !== "coversMushroomLog") return { ...save };
  return { ...save, notice: { ...notice, refusal: { ...notice.refusal, kind: "mushroomLogInTheWay" } } };
}

/** Version 51 to 52: the player can dig clay. A save from before then holds none, so it carries over unchanged. */
export function addClay(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/** Version 52 to 53: the player can shape unfired jugs from clay. A save from before then holds none, so it carries over unchanged. */
export function addUnfiredJugs(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/**
 * Version 53 to 54: the player can fire an unfired jug on a campfire or fireplace into a jug. A save from before then holds no
 * jug on a fire and no jugs, so it carries over unchanged.
 */
export function fireJugs(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/** Version 54 to 55: the player can twist cord and set fish traps. A save from before then holds none, so it carries over unchanged. */
export function addFishTraps(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/**
 * Version 55 to 56: the player can pour clean water into a jug and drink from it, so a jug can hold 1, 2, or 3 drinks. A save
 * from before then holds only empty jugs, so it carries over unchanged.
 */
export function fillJugs(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/**
 * Version 56 to 57: the ground follows the trees that stand for good, and each change of ground type is saved.
 * An older save gets the ground that matches the trees it holds now, with every change already over:
 * - clearing where a starting tree's spot holds no tree, stump, or sapling any more,
 * - forest floor round a full tree that did not stand when the valley was made, and round the stump such a tree left.
 *   A felled tree keeps its stump through the sapling stage, so a sapling growing on that stump counts too.
 * A young tree off a starting spot gets no change. The save cannot tell a young tree grown from a planted sapling, which
 * spreads no forest floor yet, from one grown back on the stump of a felled planted tree. Either way, it spreads forest
 * floor once it is full grown.
 * A save that is not plain data is passed on unchanged, so the shape check turns it away.
 */
export function matchGroundToTrees(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  // These copy GROUND_CHANGE_MINUTES and isSameTreeSpot in ground-change.ts on purpose. An upgrade keeps its own fixed
  // values, so it does the same thing however the game's rules change later (see SAVE_UPGRADES).
  const CHANGE_MINUTES = 3 * 24 * 60;
  const SAME_SPOT_METRES = 0.01;
  const { seed, clockMinutes, entities } = save;
  if (!Number.isSafeInteger(seed) || typeof clockMinutes !== "number" || !Array.isArray(entities)) return { ...save };
  const saved = entities as unknown[];
  const componentsOf = (entity: unknown) => (entity as { components?: Entity | null } | null)?.components ?? undefined;
  const spotOf = (components: Entity | undefined): GroundPoint | undefined => {
    const position = components?.position;
    return typeof position?.x === "number" && typeof position.z === "number" ? { x: position.x, z: position.z } : undefined;
  };
  const sameSpot = (a: GroundPoint, b: GroundPoint) => Math.hypot(a.x - b.x, a.z - b.z) < SAME_SPOT_METRES;
  const treeSpots: GroundPoint[] = [];
  const grownSpots: GroundPoint[] = [];
  for (const entity of saved) {
    const components = componentsOf(entity);
    const spot = spotOf(components);
    if (spot === undefined || components === undefined) continue;
    if (components.tree === true || components.growth !== undefined) treeSpots.push(spot);
    if (components.tree === true || components.stump === true) grownSpots.push(spot);
  }
  const starting = generateValley(seed as number).trees;
  const startedAtMinutes = clockMinutes - CHANGE_MINUTES;
  const gone = starting.filter((tree) => !treeSpots.some((spot) => sameSpot(spot, tree)));
  const added = grownSpots.filter((spot) => !starting.some((tree) => sameSpot(spot, tree)));
  const ids = saved.map((entity) => (entity as { id?: unknown } | null)?.id).filter((id): id is number => typeof id === "number");
  let nextId = Math.max(-1, ...ids) + 1;
  const changes = [
    ...gone.map((tree) => ({ x: tree.x, z: tree.z, toward: "clearing", startedAtMinutes })),
    ...added.map((spot) => ({ x: spot.x, z: spot.z, toward: "forestFloor", startedAtMinutes })),
  ].map((groundChange) => ({ id: nextId++, components: { groundChange } }));
  return { ...save, entities: [...saved, ...changes] };
}

/** Version 57 to 58: the player can build windows and hang shutters in them. A save from before then holds none, so it carries over unchanged. */
export function addWindows(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/**
 * Version 58 to 59: the journal suggests goals, and the game saves which are done and whether it is hidden.
 * A save from before then gets the journal shown, with no goal done here. Loading it then marks done the goals its camp proves (`addsJournal`).
 */
export function addJournal(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return { ...save, journal: { done: [], hidden: false } };
}

/**
 * Version 59 to 60: the valley turns through the seasons, which follow from the day the year started on.
 * A save from before then starts its year on the day it was saved, so it resumes on day 1 of spring.
 * A save with a broken clock is passed on unchanged, so the shape check turns it away.
 */
export function startTheYear(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  // This copies MINUTES_PER_DAY in clock.ts on purpose. An upgrade keeps its own fixed values (see SAVE_UPGRADES).
  const MINUTES_PER_DAY = 24 * 60;
  const { clockMinutes } = save;
  if (typeof clockMinutes !== "number" || !Number.isFinite(clockMinutes) || clockMinutes < 0) return { ...save };
  return { ...save, yearStartDay: Math.floor(clockMinutes / MINUTES_PER_DAY) + 1 };
}

/** Version 60 to 61: the player can build a chimney on a fireplace. A save from before then holds none, so it carries over unchanged. */
export function addChimneys(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/**
 * Version 61 to 62: the player can swap a finished log wall for a window or door frame, and a swap blueprint is saved with
 * its progress. A save from before then holds no swap, so it carries over unchanged.
 */
export function addWallSwaps(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/**
 * Version 62 to 63: fresh food spoils, and the backpack, chests, shelves, and piles save when each fresh food in them spoils.
 * A save from before then gives every fresh food its full keeping time from the moment the save loads, so the update costs
 * the player nothing (ADR 0011). A fish in a fish trap or on a fire does not spoil, so it needs nothing.
 * A save with a broken clock is passed on unchanged, so the shape check turns it away.
 */
export function spoilFreshFood(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  // These copy KEEPS_FOR_MINUTES in fresh-food.ts on purpose. An upgrade keeps its own fixed values (see SAVE_UPGRADES).
  const MINUTES_PER_DAY = 24 * 60;
  const KEEPS_FOR: Readonly<Record<string, number>> = {
    berries: 2 * MINUTES_PER_DAY,
    mushroom: 3 * MINUTES_PER_DAY,
    rawFish: 1 * MINUTES_PER_DAY,
    cookedFish: 2 * MINUTES_PER_DAY,
  };
  const { clockMinutes, entities } = save;
  if (typeof clockMinutes !== "number" || !Number.isFinite(clockMinutes) || !Array.isArray(entities)) return { ...save };
  /** The spoil times of everything fresh in `contents`, each its full keeping time from now. */
  const spoilTimesOf = (contents: Readonly<Record<string, unknown>>): Record<string, number[]> => {
    const times: Record<string, number[]> = {};
    for (const [food, keepsFor] of Object.entries(KEEPS_FOR)) {
      const count = contents[food];
      if (Number.isSafeInteger(count) && (count as number) > 0) times[food] = new Array<number>(count as number).fill(clockMinutes + keepsFor);
    }
    return times;
  };
  const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
  const upgraded: unknown[] = entities.map((entity: unknown) => {
    const components = (entity as { components?: unknown } | null)?.components;
    if (!isRecord(components)) return entity;
    const { backpack, storage, pile } = components;
    const changed: Record<string, unknown> = { ...components };
    // A holder with no fresh food in it gets no spoil times, as in a new game.
    const withTimes = (holder: Record<string, unknown>, contents: Readonly<Record<string, unknown>>): Record<string, unknown> => {
      const spoilsAt = spoilTimesOf(contents);
      return Object.keys(spoilsAt).length === 0 ? holder : { ...holder, spoilsAt };
    };
    if (isRecord(backpack) && isRecord(backpack.contents)) changed.backpack = withTimes(backpack, backpack.contents);
    if (isRecord(storage) && isRecord(storage.contents)) changed.storage = withTimes(storage, storage.contents);
    if (isRecord(pile) && typeof pile.content === "string") changed.pile = withTimes(pile, { [pile.content]: pile.count });
    return { ...(entity as object), components: changed };
  });
  return { ...save, entities: upgraded };
}

/**
 * Version 63 to 64: the player can build a drying rack, which is saved with the food on it and how far each has dried, and
 * dried berries and dried mushrooms can be kept anywhere food is kept. A save from before then holds none, so it carries over unchanged.
 */
export function addDryingRacks(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/** Version 64 to 65: the player can build wood boxes and keep firewood in them. A save from before then holds none, so it carries over unchanged. */
export function addWoodBoxes(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/**
 * Version 65 to 66: raw fish can smoke on a drying rack, and smoked fish can be kept anywhere food is kept. How far each food on
 * a rack has come is now called `minutesPreserved`, since it counts smoking as well as drying. A save from before then holds
 * no fish on a rack and no smoked fish, so only that name changes.
 */
export function smokeFish(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const { entities } = save;
  if (!Array.isArray(entities)) return { ...save };
  const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
  const upgraded: unknown[] = entities.map((entity: unknown) => {
    const components = (entity as { components?: unknown } | null)?.components;
    if (!isRecord(components) || !Array.isArray(components.dryingRack)) return entity;
    const dryingRack = components.dryingRack.map((item: unknown) => {
      if (!isRecord(item)) return item;
      const { minutesDried, ...rest } = item;
      return { ...rest, minutesPreserved: minutesDried };
    });
    return { ...(entity as object), components: { ...components, dryingRack } };
  });
  return { ...save, entities: upgraded };
}
