// The wall mode, and every rule about it. See docs/adr/0009 and docs/adr/0013.
// The wall mode says how much of every cabin the player sees through. The player picks it with the wall mode button on the HUD.
// It depends only on the camera, never on where the player stands.

/**
 * How much of every cabin the player sees through.
 * - Walls up: every cabin shows whole, with its roof.
 * - Cutaway: every cabin roof and roof frame hides, and every cabin side facing the camera fades.
 * - Walls down: every cabin roof and roof frame hides, and every cabin side fades, whichever way it faces.
 */
export type WallMode = "wallsUp" | "cutaway" | "wallsDown";

/** The wall modes in the order the button steps through them. */
export const WALL_MODES: readonly WallMode[] = ["wallsUp", "cutaway", "wallsDown"];

/** The wall mode the game starts in. The wall mode is not saved. */
export const STARTING_WALL_MODE: WallMode = "cutaway";

/** The wall mode after `mode`, wrapping from walls down back to walls up. */
export function nextWallMode(mode: WallMode): WallMode {
  return WALL_MODES[(WALL_MODES.indexOf(mode) + 1) % WALL_MODES.length] ?? STARTING_WALL_MODE;
}

/** Whether every cabin roof section and roof frame hides in `mode`. */
export function hidesRoofs(mode: WallMode): boolean {
  return mode !== "wallsUp";
}

/** Whether a cabin side fades in `mode`, given whether its outside faces the camera. A side between the camera and the player fades anyway. */
export function fadesCabinSide(mode: WallMode, facesCamera: boolean): boolean {
  if (mode === "wallsDown") return true;
  return mode === "cutaway" && facesCamera;
}
