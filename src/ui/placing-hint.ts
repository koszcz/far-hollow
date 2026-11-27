import { type BuildMenuEntry } from "../sim/api-build-menu";
import { type Plantable, type StructureKind } from "../sim/api";
import { type Refusal } from "../sim/api-refusal";
import { workText } from "../strings/work";
import { refusalText } from "./refusal-text";

/** The hint shown while placing a structure: what to click, and the keys that work. */
export interface PlacingHint {
  readonly what: string;
  readonly keys: string;
}

/**
 * The hint for placing `placing`. Pieces on an edge, over walls, or placed anywhere snap differently, so they say so.
 * When the game refuses the spot under the mouse and says why, in `refusal`, the hint says that instead.
 * It names R only for a structure that turns. Placing a structure placed in rows, such as a floor, goes on until Esc stops it.
 */
export function placingHint(entries: readonly BuildMenuEntry[], placing: StructureKind, refusal?: Refusal): PlacingHint {
  const entry = entries.find(({ structure }) => structure === placing);
  const placement = entry?.placement ?? "onGround";
  const { rotate, cancel, stop, join } = workText.hudLabels.placingKeys;
  const end = entry?.inRows === true ? stop : cancel;
  const name = workText.buildMenu.structures[placing];
  return {
    what: refusal === undefined ? workText.buildMenu.placing[placement](name) : workText.buildMenu.refusedHere(name, refusalText(refusal)),
    keys: join(entry?.fixedFacing === true ? [end] : [rotate, end]),
  };
}

/** The hint shown while planting a sapling or berry bush: what to click, or why the spot under the mouse is not allowed, and the cancel key. */
export function plantingHint(plant: Plantable, refusal: Refusal | null): PlacingHint {
  const { what, refused } = workText.plantingHint;
  return { what: refusal === null ? what[plant] : refused(refusalText(refusal)), keys: workText.hudLabels.placingKeys.cancel };
}
