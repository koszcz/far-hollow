import { FURNITURE, type FurnitureUse } from "./furniture";
import type { FurnitureKind } from "./structure-kind";

/** How the player uses a finished piece of furniture, from its definition, or undefined if it has no use, as for a table. */
export function furnitureUse(kind: FurnitureKind): FurnitureUse | undefined {
  return FURNITURE[kind].use;
}

/** The other ways the player uses a finished piece of furniture, after its main use, from its definition. Empty for most pieces. */
export function furnitureMoreUses(kind: FurnitureKind): readonly FurnitureUse[] {
  return FURNITURE[kind].moreUses ?? [];
}
