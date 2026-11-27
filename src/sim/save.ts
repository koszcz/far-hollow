// Saving and loading a game. Saves are plain data, read from game state only (ADR 0003).
import type { SaveRefusal, SaveSlotSummary } from "./api-save";
import { readClock } from "./clock";
import { createGame, type Game } from "./game";
import type { GameProgress } from "./game-start";
import { addJournal } from "./save-upgrades-from-v42";
import { turnAwayLargeValley } from "./save-upgrades-v1-to-v22";
import { isValidSave } from "./save-schema";
import { checkVersion, SAVE_UPGRADES, SAVE_VERSION, upgradeSave, type SaveUpgrade } from "./save-upgrades";

/** A saved game, as stored in the browser. It is plain data. */
export interface SaveFile extends GameProgress {
  version: number;
  seed: number;
}

export type ReadSaveResult = { ok: true; game: Game } | { ok: false; reason: SaveRefusal };

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
  const refusal = refusalBeforeUpgrade(data, upgrades);
  if (refusal !== undefined) return { ok: false, reason: refusal };
  const journalFromCamp = addsJournal(data, upgrades);
  const save = upgradeSave(data, upgrades);
  if (!isValidSave(save)) return { ok: false, reason: "notASave" };
  const { seed, clockMinutes, yearStartDay, stepCount, firstNightOver, snugRoomNoticeShown, journal, notice, entities } = save as unknown as SaveFile;
  try {
    return {
      ok: true,
      game: createGame({
        seed,
        journalFromCamp,
        progress: { clockMinutes, yearStartDay, stepCount, firstNightOver, snugRoomNoticeShown, journal, notice, entities },
      }),
    };
  } catch {
    // The save had the right shape but still could not be loaded.
    return { ok: false, reason: "notASave" };
  }
}

/**
 * Says why the game refuses a save, from its version number alone.
 * The game checks this before it upgrades the save. Returns undefined if the version is fine.
 * A save from the 1 km valley is refused only if `upgrades` turn it away.
 * So tests can still load such a save through `LARGE_VALLEY_UPGRADES`.
 */
function refusalBeforeUpgrade(data: unknown, upgrades: readonly SaveUpgrade[]): SaveRefusal | undefined {
  const checked = checkVersion(data, upgrades);
  if (!checked.ok) return checked.reason;
  if (upgrades.slice(checked.version - 1).includes(turnAwayLargeValley)) return "largeValley";
  return undefined;
}

/**
 * Whether upgrading this save adds the journal, so the save was made before the journal existed.
 * Such a save holds no goals done, so the loaded game fills them in from the camp, once.
 * The goals come from the camp after every upgrade has run, so later changes to the save format cannot break the check.
 */
function addsJournal(data: unknown, upgrades: readonly SaveUpgrade[]): boolean {
  const checked = checkVersion(data, upgrades);
  return checked.ok && upgrades.slice(checked.version - 1).includes(addJournal);
}
