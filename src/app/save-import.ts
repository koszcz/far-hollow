// Checks a file the player picked and stores it as the saved game in a save slot.

import type { ImportRefusal, SaveRefusal } from "../sim/api";
import { readSave, writeSave, type SaveFile } from "../sim/save";
import type { SaveStorage } from "./save-storage";

export type ImportResult = { ok: true; save: SaveFile } | { ok: false; reason: SaveRefusal };

/**
 * Reads a file's text as a saved game. An older saved game is upgraded to the newest version (ADR 0011).
 * Returns why the file is refused if it is not JSON or not a saved game this game can load.
 */
export function importSaveFile(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, reason: "notASave" };
  }
  const loaded = readSave(data);
  if (!loaded.ok) return loaded;
  return { ok: true, save: writeSave(loaded.game) };
}

/**
 * Checks a file's text and stores it as the saved game in a slot. Slots are numbered from 0.
 * A refused file leaves the slot as it was.
 * Returns `notStored` if the browser cannot store the saved game.
 */
export async function importIntoSlot(
  storage: SaveStorage | undefined,
  slot: number,
  text: string,
): Promise<{ ok: true; save: SaveFile } | { ok: false; reason: ImportRefusal }> {
  const imported = importSaveFile(text);
  if (!imported.ok) return imported;
  if (storage === undefined) return { ok: false, reason: "notStored" };
  try {
    await storage.write(slot, imported.save);
  } catch (error) {
    console.warn(`The imported game could not be stored in slot ${slot + 1}.`, error);
    return { ok: false, reason: "notStored" };
  }
  return imported;
}
