import { type BuildMenuEntry, type Plantable, type Refusal, type StructureKind } from "../sim/api";
import { strings } from "../strings";
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
  const { rotate, cancel, stop, join } = strings.hudLabels.placingKeys;
  const end = entry?.inRows === true ? stop : cancel;
  const name = strings.buildMenu.structures[placing];
  return {
    what: refusal === undefined ? strings.buildMenu.placing[placement](name) : strings.buildMenu.refusedHere(name, refusalText(refusal)),
    keys: join(entry?.fixedFacing === true ? [end] : [rotate, end]),
  };
}

/** The hint shown while planting a sapling or berry bush: what to click, or why the spot under the mouse is not allowed, and the cancel key. */
export function plantingHint(plant: Plantable, refusal: Refusal | null): PlacingHint {
  const { what, refused } = strings.plantingHint;
  return { what: refusal === null ? what[plant] : refused(refusalText(refusal)), keys: strings.hudLabels.placingKeys.cancel };
}
