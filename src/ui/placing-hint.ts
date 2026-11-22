import { isPlacedInRows, type BuildMenuEntry, type Refusal, type StructureKind } from "../sim/api";
import { strings } from "../strings";
import { refusalText } from "./refusal-text";

/** The hint shown while placing a structure: what to click, and the keys that work. */
export interface PlacingHint {
  readonly what: string;
  readonly keys: string;
}

/**
 * The hint for placing `placing`. Pieces on an edge, over walls, or placed anywhere snap differently, so they say so.
 * It names R only for a structure that turns. Placing a structure placed in rows, such as a floor, goes on until Esc stops it.
 */
export function placingHint(entries: readonly BuildMenuEntry[], placing: StructureKind): PlacingHint {
  const entry = entries.find(({ structure }) => structure === placing);
  const placement = entry?.placement ?? "onGround";
  const { rotate, cancel, stop, join } = strings.hudLabels.placingKeys;
  const end = isPlacedInRows(placement) ? stop : cancel;
  return {
    what: strings.buildMenu.placing[placement](strings.buildMenu.structures[placing]),
    keys: join(entry?.fixedFacing === true ? [end] : [rotate, end]),
  };
}

/** The hint shown while planting a sapling: what to click, or why the spot under the mouse is not allowed, and the cancel key. */
export function plantingHint(refusal: Refusal | null): PlacingHint {
  const { what, refused } = strings.plantingSapling;
  return { what: refusal === null ? what : refused(refusalText(refusal)), keys: strings.hudLabels.placingKeys.cancel };
}
