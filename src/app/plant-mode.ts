// Planting a sapling or berry bush from the backpack: a see-through one follows the mouse, and a click on the ground plants it there.
// This is input state, not game state, as build mode is. Only the click sends a command.
import type { Command, GameClient, Plantable, Refusal, ScenePick } from "../sim/api";
import type { GroundPoint } from "../sim/ground-point";

/**
 * The see-through sapling or berry bush under the mouse: what it is, where it would go, and why the game would refuse to plant it there,
 * or null if it would not.
 */
export interface PlantUnderMouse {
  readonly plant: Plantable;
  readonly spot: GroundPoint;
  readonly refusal: Refusal | null;
}

/**
 * The see-through `plant` for what is under the mouse, or undefined if the mouse is not over the ground.
 * Ground under a finished structure counts, so the game can say the structure is in the way.
 */
export function plantUnderMouse(plant: Plantable, seen: ScenePick | undefined, client: Pick<GameClient, "refusal">): PlantUnderMouse | undefined {
  const pick = seen?.kind === "structure" ? seen.under : seen;
  if (pick?.kind !== "ground") return undefined;
  const spot = { x: pick.spot.x, z: pick.spot.z };
  return { plant, spot, refusal: client.refusal(plantCommand(plant, spot)) };
}

/** The command a click sends while planting: plant what is under the mouse, if the game allows it there. */
export function plantCommandFor(under: PlantUnderMouse | undefined): Command | undefined {
  return under === undefined || under.refusal !== null ? undefined : plantCommand(under.plant, under.spot);
}

function plantCommand(plant: Plantable, spot: GroundPoint): Command {
  return plant === "sapling" ? { type: "plantSapling", x: spot.x, z: spot.z } : { type: "plantBerryBush", x: spot.x, z: spot.z };
}

/**
 * Whether a key press stops planting, given the key's `KeyboardEvent.code`: Escape cancels it.
 * B opens the build menu as always, and opening it stops planting too.
 */
export function pressPlantKey(code: string): boolean {
  return code === "Escape";
}
