// Saving and loading a game. Saves are plain data, read from game state only (ADR 0003).
import type { BackpackContent, SaveSlotSummary } from "./api";
import { readClock } from "./clock";
import type { Entity, SavedEntity } from "./entities";
import { valleyForageSpots } from "./foraging";
import { droppedStickSpot } from "./piles";
import { createGame, type Game, type GameProgress } from "./game";
import { generateValley } from "./valley";
import { isValidSave } from "./save-schema";

/** Turns a save of one version into the next version. It is given the save without its version number. */
export type SaveUpgrade = (save: Readonly<Record<string, unknown>>) => Record<string, unknown>;

/**
 * Every upgrade, in order. The first turns a version 1 save into version 2, the next turns version 2 into 3, and so on.
 * When a change to the game state would break older saves, add an upgrade to the end of this list.
 * A new kind of structure, notice, or component does not break older saves, so it needs no upgrade: the save check is built
 * from the structure catalogue and the notice table, and older code turns away a save that holds something it does not know.
 * Never remove or reorder an upgrade. Stored saves count on each version number keeping its place.
 * An upgrade uses its own fixed values, never the game's current rules, so it does the same thing however the game changes later.
 */
export const SAVE_UPGRADES: readonly SaveUpgrade[] = [
  addForageSpots,
  giveBedroll,
  givePot,
  giveDrawknife,
  countMaterialsSpent,
  addDeliveredMaterials,
  nameBlueprintStructure,
  faceRoofsForward,
  addWoodpiles,
  addChests,
  addPiles,
  fillChests,
  scatterDroppedSticks,
  blockWalkingAtChestsAndWoodpiles,
  renameNotEmptyNotice,
  addSawhorses,
  giveSawBlade,
  addPlanks,
  nameStationInNotice,
  addRoofFrames,
  turnAwayLargeValley,
  addSleds,
];

/** The version of the save format this code writes. */
export const SAVE_VERSION = SAVE_UPGRADES.length + 1;

/** The first save version in which every roof section faces the way it slopes down. */
export const ROOFS_FACE_SAVE_VERSION = SAVE_UPGRADES.indexOf(faceRoofsForward) + 2;
/** The first save version that can hold piles. */
export const PILES_SAVE_VERSION = SAVE_UPGRADES.indexOf(addPiles) + 2;
/** The first save version in which dropped sticks lie on the ground one by one, rather than in a pile. */
export const STICKS_ON_GROUND_SAVE_VERSION = SAVE_UPGRADES.indexOf(scatterDroppedSticks) + 2;
/** The first save version in which finished chests and woodpiles block walking. */
export const CHESTS_BLOCK_WALKING_SAVE_VERSION = SAVE_UPGRADES.indexOf(blockWalkingAtChestsAndWoodpiles) + 2;
/** The first save version whose notice that a chest or woodpile still holds something is called `stillHoldsSomething`. */
export const RENAMED_NOT_EMPTY_NOTICE_SAVE_VERSION = SAVE_UPGRADES.indexOf(renameNotEmptyNotice) + 2;
/** The first save version that can hold sawhorses. */
export const SAWHORSES_SAVE_VERSION = SAVE_UPGRADES.indexOf(addSawhorses) + 2;
/** The first save version in which the player has a saw blade, for crafting the saw. */
export const CRAFTING_SAVE_VERSION = SAVE_UPGRADES.indexOf(giveSawBlade) + 2;
/** The first save version that can hold planks. */
export const PLANKS_SAVE_VERSION = SAVE_UPGRADES.indexOf(addPlanks) + 2;
/** The first save version whose notice that no log lies beside a work station names the station. */
export const NOTICES_NAME_STATION_SAVE_VERSION = SAVE_UPGRADES.indexOf(nameStationInNotice) + 2;
/** The first save version made in the 300 m valley. Older saves cannot be loaded. */
export const SMALL_VALLEY_SAVE_VERSION = SAVE_UPGRADES.indexOf(turnAwayLargeValley) + 2;

/**
 * Every upgrade before the valley shrank. A save from the 1 km valley can no longer be loaded, but tests still load older
 * saves through these, to check what each older upgrade does.
 */
export const LARGE_VALLEY_UPGRADES: readonly SaveUpgrade[] = SAVE_UPGRADES.slice(0, SMALL_VALLEY_SAVE_VERSION - 2);

/** The first save version in which every roof section is laid on a roof frame. */
export const ROOF_FRAMES_SAVE_VERSION = SAVE_UPGRADES.indexOf(addRoofFrames) + 2;
/** The first save version that can hold sleds. */
export const SLEDS_SAVE_VERSION = SAVE_UPGRADES.indexOf(addSleds) + 2;

/**
 * Brings a save up to the newest version the upgrades reach, one version at a time.
 * Returns undefined if the data is not a save, or its version is missing or newer than the upgrades know.
 */
export function upgradeSave(data: unknown, upgrades: readonly SaveUpgrade[] = SAVE_UPGRADES): Record<string, unknown> | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const { version, ...save } = data as Record<string, unknown>;
  const newest = upgrades.length + 1;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1 || version > newest) return undefined;
  let upgraded: Record<string, unknown> = save;
  for (const upgrade of upgrades.slice(version - 1)) upgraded = upgrade(upgraded);
  return { version: newest, ...upgraded };
}

/** A saved game, as stored in the browser. It is plain data. */
export interface SaveFile extends GameProgress {
  version: number;
  seed: number;
}

export type ReadSaveResult = { ok: true; game: Game } | { ok: false };

/** Reads a game's state into a save. Changing the save does not change the game. */
export function writeSave(game: Game): SaveFile {
  return { version: SAVE_VERSION, seed: game.client.getView().seed, ...game.progress() };
}

/**
 * Continues the stored game, or starts a new one from `newSeed` if nothing is stored.
 * If the stored save is broken, the new game opens with a notice telling the player.
 */
export function continueOrStartGame(stored: unknown, newSeed: number): Game {
  if (stored === undefined) return createGame({ seed: newSeed });
  const loaded = readSave(stored);
  return loaded.ok ? loaded.game : createGame({ seed: newSeed, startNotice: "saveBroken" });
}

/** Says what a save slot holds, for the start screen: nothing, a save that cannot be loaded, or a game's seed and day. */
export function describeSave(stored: unknown): SaveSlotSummary {
  if (stored === undefined) return { state: "empty" };
  const save = upgradeSave(stored);
  if (!isValidSave(save)) return { state: "broken" };
  const { seed, clockMinutes } = save as unknown as SaveFile;
  return { state: "filled", seed, day: readClock(clockMinutes).day };
}

/**
 * Turns stored data back into a game, upgrading an older save first.
 * Returns `ok: false` if the data is not a save this game can load.
 * `upgrades` defaults to every upgrade. Tests pass fewer, to load a save the way an older game did.
 */
export function readSave(data: unknown, upgrades: readonly SaveUpgrade[] = SAVE_UPGRADES): ReadSaveResult {
  const save = upgradeSave(data, upgrades);
  if (!isValidSave(save)) return { ok: false };
  const { seed, clockMinutes, stepCount, firstNightOver, notice, entities } = save as unknown as SaveFile;
  try {
    return { ok: true, game: createGame({ seed, progress: { clockMinutes, stepCount, firstNightOver, notice, entities } }) };
  } catch {
    // The save had the right shape but still could not be loaded.
    return { ok: false };
  }
}

/**
 * Version 1 to 2: berry bushes and mushrooms grow in the valley. A save from before then gets the valley's spots, all with food.
 * A save that is not plain data is passed on unchanged, so the shape check turns it away.
 */
function addForageSpots(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const { seed, entities } = save;
  if (!Number.isSafeInteger(seed) || !Array.isArray(entities)) return { ...save };
  const saved = entities as unknown[];
  const idOf = (entity: unknown): number => {
    const id = (entity as Partial<SavedEntity> | null)?.id;
    return typeof id === "number" ? id : -1;
  };
  const lastId = saved.reduce<number>((last, entity) => Math.max(last, idOf(entity)), -1);
  const spots = valleyForageSpots(generateValley(seed as number)).map((components, index) => ({ id: lastId + 1 + index, components }));
  return { ...save, entities: [...saved, ...spots] };
}

/** Version 2 to 3: a new game now starts with a bedroll, so a player saved before bedrolls existed gets one too. */
function giveBedroll(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return giveStartingItem(save, "bedroll");
}

/** Version 3 to 4: a new game now starts with a pot, so a player saved before pots existed gets one too. */
function givePot(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return giveStartingItem(save, "pot");
}

/** Version 4 to 5: a new game now starts with a drawknife, so a player saved before drawknives existed gets one too. */
function giveDrawknife(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return giveStartingItem(save, "drawknife");
}

/**
 * Version 5 to 6: structures can cost more than sticks, so a blueprint counts the materials spent on it, not the sticks.
 * Until then only sticks were spent, so the count carries over.
 */
function countMaterialsSpent(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  if (!Array.isArray(save.entities)) return { ...save };
  const entities: unknown[] = save.entities.map((entity: unknown) => {
    const components = (entity as { components?: Record<string, unknown> } | null)?.components;
    const blueprint = components?.blueprint;
    if (typeof blueprint !== "object" || blueprint === null || !("sticksSpent" in blueprint)) return entity;
    const { sticksSpent, ...rest } = blueprint;
    return { ...(entity as object), components: { ...components, blueprint: { ...rest, materialsSpent: sticksSpent } } };
  });
  return { ...save, entities };
}

/**
 * Version 6 to 7: the player can carry materials, such as debarked logs, to a blueprint, and the blueprint counts them.
 * Nothing was carried to a blueprint saved before then.
 */
function addDeliveredMaterials(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  if (!Array.isArray(save.entities)) return { ...save };
  const entities: unknown[] = save.entities.map((entity: unknown) => {
    const components = (entity as { components?: Record<string, unknown> } | null)?.components;
    const blueprint = components?.blueprint;
    if (typeof blueprint !== "object" || blueprint === null || "delivered" in blueprint) return entity;
    return { ...(entity as object), components: { ...components, blueprint: { ...blueprint, delivered: {} } } };
  });
  return { ...save, entities };
}

/**
 * Version 7 to 8: a blueprint names the structure it is a blueprint of in `structure`, not `piece`,
 * since a campfire or a lean-to is a structure, not a building piece.
 */
function nameBlueprintStructure(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  if (!Array.isArray(save.entities)) return { ...save };
  const entities: unknown[] = save.entities.map((entity: unknown) => {
    const components = (entity as { components?: Record<string, unknown> } | null)?.components;
    const blueprint = components?.blueprint;
    if (typeof blueprint !== "object" || blueprint === null || !("piece" in blueprint)) return entity;
    const { piece, ...rest } = blueprint;
    return { ...(entity as object), components: { ...components, blueprint: { structure: piece, ...rest } } };
  });
  return { ...save, entities };
}

/**
 * Version 8 to 9: turns every roof section, finished or as a blueprint, to slope down to +z. Before roofs faced a direction, every roof
 * sloped that way, whatever turn the player gave its blueprint, so an older save keeps the roofs it showed.
 */
function faceRoofsForward(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  if (!Array.isArray(save.entities)) return { ...save };
  const entities: unknown[] = save.entities.map((entity: unknown) => {
    const components = (entity as { components?: Entity } | null)?.components;
    const isRoof = components?.cabinRoof === true || components?.blueprint?.structure === "roof";
    if (!isRoof) return entity;
    return { ...(entity as object), components: { ...components, facing: { turns: 0 } } };
  });
  return { ...save, entities };
}

/**
 * For a version that added something older saves never hold, such as a new kind of structure. The save carries over unchanged.
 * Versions 10, 11, 12, 17, 19, and 23 did this. New kinds no longer need a version of their own.
 */
function nothingToUpgrade(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return { ...save };
}

/** Version 9 to 10: the player can build woodpiles. A save from before then has none, so it carries over unchanged. */
function addWoodpiles(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/** Version 10 to 11: the player can build chests. A save from before then has none, so it carries over unchanged. */
function addChests(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/** Version 11 to 12: the player can drop things in piles. A save from before then has none, so it carries over unchanged. */
function addPiles(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/**
 * Version 12 to 13: a chest holds small materials, tools, and food. A chest saved before then held nothing, so it becomes an empty chest.
 */
function fillChests(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  if (!Array.isArray(save.entities)) return { ...save };
  const entities: unknown[] = save.entities.map((entity: unknown) => {
    const components = (entity as { components?: Record<string, unknown> } | null)?.components;
    const chest = components?.chest;
    if (typeof chest !== "object" || chest === null || "contents" in chest) return entity;
    return { ...(entity as object), components: { ...components, chest: { ...chest, contents: {} } } };
  });
  return { ...save, entities };
}

/**
 * Version 13 to 14: dropped sticks lie on the ground one by one, the same as sticks on the forest floor.
 * Each pile of sticks becomes that many sticks, spread round where the pile lay.
 */
function scatterDroppedSticks(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  if (!Array.isArray(save.entities)) return { ...save };
  const saved = save.entities as unknown[];
  const ids = saved.map((entity) => (entity as { id?: unknown } | null)?.id).filter((id): id is number => typeof id === "number");
  let nextId = Math.max(-1, ...ids) + 1;
  const entities: unknown[] = [];
  for (const entity of saved) {
    const components = (entity as { components?: Record<string, unknown> } | null)?.components;
    const pile = components?.pile as { content?: unknown; count?: unknown } | undefined;
    const position = components?.position as { x: number; y: number; z: number } | undefined;
    if (pile?.content !== "stick" || typeof pile.count !== "number" || position === undefined) {
      entities.push(entity);
      continue;
    }
    for (let index = 0; index < pile.count; index += 1) {
      const id = index === 0 ? (entity as { id: number }).id : nextId++;
      entities.push({ id, components: { stick: true, position: { ...droppedStickSpot(position, index), y: position.y } } });
    }
  }
  return { ...save, entities };
}

/**
 * Version 14 to 15: a finished chest blocks walking, and a finished woodpile blocks the ground it covers.
 * Before then a chest blocked nothing, and a woodpile's reach was too short to block any walk-map cell.
 * The reaches are the ones version 15 gave them, kept here so a later change to the game's rules does not change this upgrade.
 */
function blockWalkingAtChestsAndWoodpiles(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const CHEST_REACH_METRES = 0.71;
  const WOODPILE_REACH_METRES = 0.75;
  if (!Array.isArray(save.entities)) return { ...save };
  const entities: unknown[] = save.entities.map((entity: unknown) => {
    const components = (entity as { components?: Record<string, unknown> } | null)?.components;
    if (components?.chest !== undefined) return { ...(entity as object), components: { ...components, blocksWalking: { radius: CHEST_REACH_METRES } } };
    if (components?.woodpile !== undefined) return { ...(entity as object), components: { ...components, blocksWalking: { radius: WOODPILE_REACH_METRES } } };
    return entity;
  });
  return { ...save, entities };
}

/** Version 15 to 16: the notice that a chest or woodpile still holds something is renamed to `stillHoldsSomething`. */
function renameNotEmptyNotice(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const notice = save.notice as { kind?: unknown } | null | undefined;
  if (notice?.kind !== "storageNotEmpty") return { ...save };
  return { ...save, notice: { ...notice, kind: "stillHoldsSomething" } };
}

/** Version 16 to 17: the player can build sawhorses. A save from before then has none, so it carries over unchanged. */
function addSawhorses(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/**
 * Version 17 to 18: a new game now starts with a saw blade, for crafting the saw. A player saved before then gets one too,
 * unless they already hold a saw.
 */
function giveSawBlade(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return giveStartingItem(save, "sawBlade", ["saw"]);
}

/** Version 18 to 19: the player can cut planks. A save from before then has none, so it carries over unchanged. */
function addPlanks(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}

/** Before roof frames, a roof section cost this many debarked logs, spent first, then its bark. */
const OLD_ROOF_LOG_COST = 3;
/** Before roof frames, a roof section had this many stages: one per debarked log, then one per piece of bark. */
const OLD_ROOF_STAGES = 7;
/** When roof frames came in, a roof frame cost this many debarked logs, one per stage. */
const FIRST_ROOF_FRAME_LOG_COST = 5;

/**
 * Version 20 to 21: a roof section is laid on a roof frame, which holds the rafters, so the roof is only bark.
 * Every finished roof gets a finished frame under it, with the roof's turn, for free.
 * Every roof blueprint becomes a frame blueprint with the same turn, keeping its delivered logs and the work done with them.
 * Any bark already spent on it goes back in the player's backpack, so nothing is lost.
 */
function addRoofFrames(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  if (!Array.isArray(save.entities)) return { ...save };
  const saved = save.entities as unknown[];
  const ids = saved.map((entity) => (entity as { id?: unknown } | null)?.id).filter((id): id is number => typeof id === "number");
  let nextId = Math.max(-1, ...ids) + 1;
  let barkBack = 0;
  const entities: unknown[] = [];
  for (const entity of saved) {
    const components = (entity as { components?: Entity } | null)?.components;
    const blueprint = components?.blueprint;
    if (components?.cabinRoof === true && components.position !== undefined) {
      entities.push(entity, { id: nextId++, components: { roofFrame: true, facing: components.facing ?? { turns: 0 }, position: { ...components.position } } });
    } else if (blueprint?.structure === "roof" && typeof blueprint.materialsSpent === "number" && typeof blueprint.progress === "number") {
      const logsSpent = Math.min(blueprint.materialsSpent, OLD_ROOF_LOG_COST);
      barkBack += blueprint.materialsSpent - logsSpent;
      const stagesDone = Math.min(blueprint.progress * OLD_ROOF_STAGES, OLD_ROOF_LOG_COST);
      const frame = { ...blueprint, structure: "roofFrame", progress: stagesDone / FIRST_ROOF_FRAME_LOG_COST, materialsSpent: logsSpent };
      entities.push({ ...(entity as object), components: { ...components, blueprint: frame } });
    } else {
      entities.push(entity);
    }
  }
  return giveBack({ ...save, entities }, "bark", barkBack);
}

/** Puts `count` of a material into the saved player's backpack, on top of what they hold. */
function giveBack(save: Record<string, unknown>, material: "bark", count: number): Record<string, unknown> {
  if (count === 0 || !Array.isArray(save.entities)) return save;
  const entities: unknown[] = save.entities.map((entity: unknown) => {
    const components = (entity as { components?: Entity } | null)?.components;
    const contents = components?.backpack?.contents;
    if (components?.player !== true || typeof contents !== "object") return entity;
    return {
      ...(entity as object),
      components: { ...components, backpack: { ...components.backpack, contents: { ...contents, [material]: (contents[material] ?? 0) + count } } },
    };
  });
  return { ...save, entities };
}

/**
 * Version 19 to 20: the notice that no log lies beside a work station now names the station.
 * The sawhorse was the only work station before then, so an older notice names it.
 */
function nameStationInNotice(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const notice = save.notice as { kind?: unknown } | null | undefined;
  if (notice?.kind !== "noLogBesideStation") return { ...save };
  return { ...save, notice: { ...notice, station: "sawhorse" } };
}

/**
 * Puts one of an item a new game starts with into the saved player's backpack,
 * unless they already have one, or hold anything listed in `madeFrom`, which are things made from it.
 */
function giveStartingItem(
  save: Readonly<Record<string, unknown>>,
  item: "bedroll" | "pot" | "drawknife" | "sawBlade",
  madeFrom: readonly BackpackContent[] = [],
): Record<string, unknown> {
  if (!Array.isArray(save.entities)) return { ...save };
  const entities: unknown[] = save.entities.map((entity: unknown) => {
    const components = (entity as { components?: Entity } | null)?.components;
    const contents = components?.backpack?.contents;
    if (components?.player !== true || typeof contents !== "object") return entity;
    if ([item, ...madeFrom].some((held) => (contents[held] ?? 0) > 0)) return entity;
    return { ...(entity as object), components: { ...components, backpack: { ...components.backpack, contents: { ...contents, [item]: 1 } } } };
  });
  return { ...save, entities };
}

/**
 * Version 21 to 22: the valley shrank from 1 km to 300 m on each side, with denser forest. An older save holds trees,
 * sticks, and buildings where the new valley has other ground, or none at all, so it cannot be carried over.
 * This upgrade empties the save, so the shape check turns it away and its slot shows as broken.
 */
function turnAwayLargeValley(): Record<string, unknown> {
  return {};
}

/**
 * Version 22 to 23: the player can build sleds, and a blueprint can hold logs carried to it. A save from before then has
 * neither, so it carries over unchanged.
 */
function addSleds(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return nothingToUpgrade(save);
}
