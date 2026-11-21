import type { Command, GameClient, ScenePick, StructureKind } from "../sim/api";
import { turnQuarters, type QuarterTurns } from "../sim/quarter-turns";

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

/**
 * The command a click sends while placing a blueprint. Only a click on the ground places one.
 * The player then starts building it at once, if they have what its first stage needs.
 */
export function placeCommandFor(mode: BuildMode, pick: ScenePick): Command | undefined {
  if (mode.placing === null || pick.kind !== "ground") return undefined;
  return { type: "placeBlueprint", structure: mode.placing.structure, turns: mode.placing.turns, x: pick.spot.x, z: pick.spot.z, thenBuild: true };
}

/** The structures the player places one after another: build mode stays open after each, and a Shift-drag places a row of them. */
const PLACED_IN_ROWS: ReadonlySet<StructureKind> = new Set<StructureKind>(["floor"]);

/** Build mode once a click has placed a blueprint. Placing a floor keeps it open on the floor, so the player can place the next. */
export function modeAfterPlacing(mode: BuildMode): BuildMode {
  return mode.placing !== null && PLACED_IN_ROWS.has(mode.placing.structure) ? mode : NOT_BUILDING;
}

/** One Shift-drag that places blueprints. */
export interface Sweep {
  /**
   * The command that places a blueprint where the pointer is now, or undefined if it places none.
   * It places one only on ground where the blueprint is allowed, and only once on each spot during the sweep.
   * The player does not start building it.
   */
  over(pick: ScenePick): Command | undefined;
}

/** Starts a Shift-drag that places a blueprint on each allowed spot the pointer crosses. Undefined if the structure being placed is not placed in rows. */
export function startSweep(mode: BuildMode, client: Pick<GameClient, "checkPlacement">): Sweep | undefined {
  const placing = mode.placing;
  if (placing === null || !PLACED_IN_ROWS.has(placing.structure)) return undefined;
  // The game takes the commands at its next logic step, so the sweep remembers the spots it has placed on until then.
  const placed = new Set<string>();
  return {
    over(pick) {
      if (pick.kind !== "ground") return undefined;
      const { spot, turns, allowed } = client.checkPlacement(placing.structure, pick.spot, placing.turns);
      const key = `${spot.x},${spot.z}`;
      if (!allowed || placed.has(key)) return undefined;
      placed.add(key);
      return { type: "placeBlueprint", structure: placing.structure, turns, x: spot.x, z: spot.z };
    },
  };
}

/** What a key press does to build mode, given the key's `KeyboardEvent.code`. Undefined if the key does nothing here. */
export function pressBuildKey(mode: BuildMode, code: string): BuildMode | undefined {
  if (code === "KeyB") return mode.menuOpen ? NOT_BUILDING : { menuOpen: true, placing: null };
  if (code === "Escape" && (mode.menuOpen || mode.placing !== null)) return NOT_BUILDING;
  if (code === "KeyR" && mode.placing !== null) {
    return { ...mode, placing: { ...mode.placing, turns: turnQuarters(mode.placing.turns, 1) } };
  }
  return undefined;
}
