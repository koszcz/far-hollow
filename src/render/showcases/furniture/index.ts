// The asset showcase of each piece of furniture, keyed by its asset id. building.ts lists them.
// A piece's asset id is its kind, except where the catalogue spells it apart, as "rain-barrel" for the rain barrel, "drying-rack" for the drying rack, and "wood-box" for the wood box.
import type { FurnitureKind } from "../../../sim/structure-kind";
import type { Showcase } from "../types";
import { BED_SHOWCASE } from "./bed";
import { CHEST_SHOWCASE } from "./chest";
import { DRYING_RACK_SHOWCASE } from "./drying-rack";
import { RAIN_BARREL_SHOWCASE } from "./rain-barrel";
import { SHELF_SHOWCASE } from "./shelf";
import { STOOL_SHOWCASE } from "./stool";
import { TABLE_SHOWCASE } from "./table";
import { WOOD_BOX_SHOWCASE } from "./wood-box";

/** Each piece of furniture's showcase, by its kind. TypeScript reports a piece with no entry. */
const SHOWCASES_BY_KIND: { readonly [Kind in FurnitureKind]: Showcase } = {
  chest: CHEST_SHOWCASE,
  shelf: SHELF_SHOWCASE,
  bed: BED_SHOWCASE,
  table: TABLE_SHOWCASE,
  stool: STOOL_SHOWCASE,
  rainBarrel: RAIN_BARREL_SHOWCASE,
  dryingRack: DRYING_RACK_SHOWCASE,
  woodBox: WOOD_BOX_SHOWCASE,
};

/** The asset id of each piece whose id is not its kind. */
const ASSET_IDS: Readonly<Partial<Record<FurnitureKind, string>>> = { rainBarrel: "rain-barrel", dryingRack: "drying-rack", woodBox: "wood-box" };

/** Each piece of furniture's showcase, by its asset id. */
export const FURNITURE_SHOWCASES: Readonly<Record<string, Showcase>> = Object.fromEntries(
  (Object.entries(SHOWCASES_BY_KIND) as [FurnitureKind, Showcase][]).map(([kind, showcase]) => [ASSET_IDS[kind] ?? kind, showcase]),
);
