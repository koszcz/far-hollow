// The asset showcase of each piece of furniture, keyed by its kind, which is also its asset id. building.ts lists them.
import type { FurnitureKind } from "../../../sim/structure-kind";
import type { Showcase } from "../types";
import { BED_SHOWCASE } from "./bed";
import { CHEST_SHOWCASE } from "./chest";
import { SHELF_SHOWCASE } from "./shelf";
import { STOOL_SHOWCASE } from "./stool";
import { TABLE_SHOWCASE } from "./table";

/** Each piece of furniture's showcase. TypeScript reports a piece with no entry. */
export const FURNITURE_SHOWCASES: { readonly [Kind in FurnitureKind]: Showcase } = {
  chest: CHEST_SHOWCASE,
  shelf: SHELF_SHOWCASE,
  bed: BED_SHOWCASE,
  table: TABLE_SHOWCASE,
  stool: STOOL_SHOWCASE,
};
