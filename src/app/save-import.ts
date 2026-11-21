// Checks a file the player picked and turns it into a saved game the game can store in a save slot.

import type { SaveRefusal } from "../sim/api";
import { readSave, writeSave, type SaveFile } from "../sim/save";

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
