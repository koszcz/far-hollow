/**
 * Why the game refuses to load a save (ADR 0008):
 * - `notASave`: the data is not a Far Hollow saved game, or it is damaged.
 * - `largeValley`: the save was made in the 1 km valley, before the valley shrank.
 * - `newerVersion`: the save was made by a newer version of the game.
 */
export type SaveRefusal = "notASave" | "largeValley" | "newerVersion";

/**
 * Why the game could not import a file into a save slot: any reason it refuses a save, or `notStored`.
 * `notStored` means the file was fine, but the browser could not store it.
 */
export type ImportRefusal = SaveRefusal | "notStored";

/**
 * What one save slot holds, as the start screen shows it.
 * `empty`: nothing is saved there. `broken`: the save cannot be loaded.
 * `filled`: a game the player can continue, with its seed and the day it reached.
 */
export type SaveSlotSummary =
  { readonly state: "empty" } | { readonly state: "broken" } | { readonly state: "filled"; readonly seed: number; readonly day: number };
