// Planting a sapling from the backpack: a see-through sapling follows the mouse, and a click on the ground plants it there.
// This is input state, not game state, as build mode is. Only the click sends a command.
import type { Command, GameClient, Refusal, ScenePick } from "../sim/api";
import type { GroundPoint } from "../sim/ground-point";

/** The see-through sapling under the mouse: where it would go, and why the game would refuse to plant it there, or null if it would not. */
export interface SaplingUnderMouse {
  readonly spot: GroundPoint;
  readonly refusal: Refusal | null;
}

/**
 * The see-through sapling for what is under the mouse, or undefined if the mouse is not over the ground.
 * Ground under a finished structure counts, so the game can say the structure is in the way.
 */
export function saplingUnderMouse(seen: ScenePick | undefined, client: Pick<GameClient, "refusal">): SaplingUnderMouse | undefined {
  const pick = seen?.kind === "structure" ? seen.under : seen;
  if (pick?.kind !== "ground") return undefined;
  const spot = { x: pick.spot.x, z: pick.spot.z };
  return { spot, refusal: client.refusal(plantCommand(spot)) };
}

/** The command a click sends while planting: plant the sapling under the mouse, if the game allows it there. */
export function plantCommandFor(sapling: SaplingUnderMouse | undefined): Command | undefined {
  return sapling === undefined || sapling.refusal !== null ? undefined : plantCommand(sapling.spot);
}

function plantCommand(spot: GroundPoint): Command {
  return { type: "plantSapling", x: spot.x, z: spot.z };
}

/**
 * Whether a key press stops planting, given the key's `KeyboardEvent.code`: Escape cancels it.
 * B opens the build menu as always, and opening it stops planting too.
 */
export function pressPlantKey(code: string): boolean {
  return code === "Escape";
}
