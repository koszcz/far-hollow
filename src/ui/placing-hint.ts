import type { BuildMenuEntry, StructureKind } from "../sim/api";
import { strings } from "../strings";

/** The hint shown while placing a structure: what to click, and the keys that work. */
export interface PlacingHint {
  readonly what: string;
  readonly keys: string;
}

/**
 * The hint for placing `placing`. Pieces on an edge, over walls, or placed anywhere snap differently, so they say so.
 * A roof section follows its frame and cannot turn, so its hint names only the cancel key.
 */
export function placingHint(entries: readonly BuildMenuEntry[], placing: StructureKind): PlacingHint {
  const placement = entries.find(({ structure }) => structure === placing)?.placement ?? "onGround";
  const { rotate, cancel, join } = strings.hudLabels.placingKeys;
  return {
    what: strings.buildMenu.placing[placement](strings.buildMenu.structures[placing]),
    keys: join(placement === "onFrame" ? [cancel] : [rotate, cancel]),
  };
}
