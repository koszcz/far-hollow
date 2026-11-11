import type { ScenePick } from "../render/scene-renderer";
import type { Command, QuarterTurns, StructureKind } from "../sim/api";

/**
 * Whether the build menu is open, and which structure's blueprint follows the mouse, if any.
 * This is input state, not game state. Only placing the blueprint sends a command.
 */
export interface BuildMode {
  readonly menuOpen: boolean;
  /** The structure being placed and which way it faces, or null while not placing. */
  readonly placing: { readonly structure: StructureKind; readonly turns: QuarterTurns } | null;
}

/** The build menu is shut and nothing is being placed. */
export const NOT_BUILDING: BuildMode = Object.freeze({ menuOpen: false, placing: null });

/** Picking an entry closes the menu. Its blueprint then follows the mouse, facing the default way. */
export function pickBuildEntry(structure: StructureKind): BuildMode {
  return { menuOpen: false, placing: { structure, turns: 0 } };
}

/** The command a left-click sends while placing a blueprint. Only a click on the ground places one. */
export function placeCommandFor(mode: BuildMode, pick: ScenePick): Command | undefined {
  if (mode.placing === null || pick.kind !== "ground") return undefined;
  return { type: "placeBlueprint", structure: mode.placing.structure, turns: mode.placing.turns, x: pick.spot.x, z: pick.spot.z };
}

/** What a key press does to build mode, given the key's `KeyboardEvent.code`. Undefined if the key does nothing here. */
export function pressBuildKey(mode: BuildMode, code: string): BuildMode | undefined {
  if (code === "KeyB") return mode.menuOpen ? NOT_BUILDING : { menuOpen: true, placing: null };
  if (code === "Escape" && (mode.menuOpen || mode.placing !== null)) return NOT_BUILDING;
  if (code === "KeyR" && mode.placing !== null) {
    return { ...mode, placing: { ...mode.placing, turns: ((mode.placing.turns + 1) % 4) as QuarterTurns } };
  }
  return undefined;
}
