import type { BackpackContent } from "./backpack";
import type { Recipe } from "./crafting";
import { FURNITURE, type FurnitureUse } from "./furniture";
import { FURNITURE_KINDS, type BuildMenuKind } from "./structure-kind";
import type { FurnitureKind, MaterialCost, Placement } from "./structures";

/** One structure in the build menu. */
export interface BuildMenuEntry {
  readonly structure: BuildMenuKind;
  /** Everything building it costs. Placing its blueprint costs nothing. Construction spends it. */
  readonly cost: readonly MaterialCost[];
  /** The tool the player needs in the backpack to build it. Missing if it needs none. Building does not use the tool up. */
  readonly tool?: BackpackContent;
  /** How its blueprint follows the mouse while the player places it. Furniture goes "anywhere", off the building grid. */
  readonly placement: Placement;
  /** Present when R does not turn its blueprint, as for a roof section, a door, or a floor. Missing if R turns it. */
  readonly fixedFacing?: true;
  /**
   * Present when the player places it in rows: build mode stays open after each blueprint, and a Shift-drag places a row.
   * A floor always is. In the instant playground, every piece on the building grid is.
   */
  readonly inRows?: true;
}

/** The build menu's furniture rows, in order, from each piece's definition. The HUD showcase shows the full build menu with them. */
export const FURNITURE_BUILD_MENU: readonly BuildMenuEntry[] = FURNITURE_KINDS.map((kind) => {
  const { cost, tool } = FURNITURE[kind];
  return { structure: kind, cost, ...(tool === undefined ? {} : { tool }), placement: "anywhere" };
});

/** How the player uses a finished piece of furniture, from its definition, or undefined if it has no use, as for a table. */
export function furnitureUse(kind: FurnitureKind): FurnitureUse | undefined {
  return FURNITURE[kind].use;
}

/** The other ways the player uses a finished piece of furniture, after its main use, from its definition. Empty for most pieces. */
export function furnitureMoreUses(kind: FurnitureKind): readonly FurnitureUse[] {
  return FURNITURE[kind].moreUses ?? [];
}

/** One recipe in the craft menu. What the player lacks to follow it now comes from `GameClient.refusal`. */
export type CraftMenuEntry = Recipe;
