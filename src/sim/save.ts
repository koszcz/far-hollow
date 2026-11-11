// Saving and loading a game. Saves are plain data, read from game state only (ADR 0003).
import type { SaveSlotSummary } from "./api";
import { readClock } from "./clock";
import type { Entity, SavedEntity } from "./entities";
import { valleyForageSpots } from "./foraging";
import { createGame, type Game, type GameProgress } from "./game";
import { generateValley } from "./valley";
import { isValidSave } from "./save-schema";

/** Turns a save of one version into the next version. It is given the save without its version number. */
export type SaveUpgrade = (save: Readonly<Record<string, unknown>>) => Record<string, unknown>;

/**
 * Every upgrade, in order. The first turns a version 1 save into version 2, the next turns version 2 into 3, and so on.
 * When a change to the game state would break older saves, add an upgrade to the end of this list.
 */
export const SAVE_UPGRADES: readonly SaveUpgrade[] = [addForageSpots, giveBedroll, givePot, giveDrawknife, countMaterialsSpent, addDeliveredMaterials, addWoodpiles];

/** The version of the save format this code writes. */
export const SAVE_VERSION = SAVE_UPGRADES.length + 1;

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
 */
export function readSave(data: unknown): ReadSaveResult {
  const save = upgradeSave(data);
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
 * Version 7 to 8: the player can build woodpiles and stack wood on them. A save from before then has no woodpiles,
 * so it carries over unchanged.
 */
function addWoodpiles(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return { ...save };
}

/** Puts one of an item a new game starts with into the saved player's backpack, unless they already have one. */
function giveStartingItem(save: Readonly<Record<string, unknown>>, item: "bedroll" | "pot" | "drawknife"): Record<string, unknown> {
  if (!Array.isArray(save.entities)) return { ...save };
  const entities: unknown[] = save.entities.map((entity: unknown) => {
    const components = (entity as { components?: Entity } | null)?.components;
    const contents = components?.backpack?.contents;
    if (components?.player !== true || typeof contents !== "object" || (contents[item] ?? 0) > 0) return entity;
    return { ...(entity as object), components: { ...components, backpack: { ...components.backpack, contents: { ...contents, [item]: 1 } } } };
  });
  return { ...save, entities };
}
