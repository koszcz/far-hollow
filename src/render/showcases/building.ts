// Showcases for structures built on a foundation: the deck, furniture, the sled, walls, and roofs. The registry is src/render/showcases/index.ts.
// Each family of structures has its own file: building-shell, building-hearth, building-sled, building-openings, and building-roofs.
// Each piece of furniture has its own showcase file in ./furniture/.
import type { Showcase } from "./types";
import { FURNITURE_SHOWCASES } from "./furniture";
import { SHELL_SHOWCASES } from "./building-shell";
import { HEARTH_SHOWCASES } from "./building-hearth";
import { SLED_SHOWCASES } from "./building-sled";
import { OPENINGS_SHOWCASES } from "./building-openings";
import { ROOF_SHOWCASES } from "./building-roofs";

export const BUILDING_SHOWCASES: Readonly<Record<string, Showcase>> = {
  ...SHELL_SHOWCASES,
  ...FURNITURE_SHOWCASES,
  ...HEARTH_SHOWCASES,
  ...SLED_SHOWCASES,
  ...OPENINGS_SHOWCASES,
  ...ROOF_SHOWCASES,
};
