// Every asset showcase, keyed by asset id. Each file holds one family of assets. Add a new asset to the file for its family.
import { NATURE_SHOWCASES } from "./nature";
import { BUILDING_SHOWCASES } from "./building";
import { CAMP_SHOWCASES } from "./camp";
import { INTERFACE_SHOWCASES } from "./interface";
import { WEATHER_SHOWCASES } from "./weather";
import { ANIMATIONS_SHOWCASES } from "./animations";
import type { Showcase } from "./types";

export const SHOWCASES: Readonly<Record<string, Showcase>> = {
  ...NATURE_SHOWCASES,
  ...BUILDING_SHOWCASES,
  ...CAMP_SHOWCASES,
  ...INTERFACE_SHOWCASES,
  ...WEATHER_SHOWCASES,
  ...ANIMATIONS_SHOWCASES,
};
