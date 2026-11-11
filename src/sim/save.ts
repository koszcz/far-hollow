// Saving and loading a game. Saves are plain data, read from game state only (ADR 0003).
import type { Entity } from "./entities";
import { createGame, type Game, type GameProgress } from "./game";
import { isValidSave } from "./save-schema";

/** Turns a save of one version into the next version. It is given the save without its version number. */
export type SaveUpgrade = (save: Readonly<Record<string, unknown>>) => Record<string, unknown>;

/**
 * Every upgrade, in order. The first turns a version 1 save into version 2, the next turns version 2 into 3, and so on.
 * When a change to the game state would break older saves, add an upgrade to the end of this list.
 */
export const SAVE_UPGRADES: readonly SaveUpgrade[] = [giveBedroll];

/** Version 1 to 2: a new game now starts with a bedroll, so a player saved before bedrolls existed gets one too. */
function giveBedroll(save: Readonly<Record<string, unknown>>): Record<string, unknown> {
  if (!Array.isArray(save.entities)) return { ...save };
  const entities: unknown[] = save.entities.map((entity: unknown) => {
    const components = (entity as { components?: Entity } | null)?.components;
    const contents = components?.backpack?.contents;
    if (components?.player !== true || typeof contents !== "object" || (contents.bedroll ?? 0) > 0) return entity;
    return { ...(entity as object), components: { ...components, backpack: { ...components.backpack, contents: { ...contents, bedroll: 1 } } } };
  });
  return { ...save, entities };
}

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
