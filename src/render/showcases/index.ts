// Every asset showcase, keyed by asset id. Each file holds one family of assets. Add a new asset to the file for its family.
// An animation gets its own file in ./animations and one line in ./animations/registry.ts.
import { NATURE_SHOWCASES } from "./nature";
import { BUILDING_SHOWCASES } from "./building";
import { CAMP_SHOWCASES } from "./camp";
import { INTERFACE_SHOWCASES } from "./interface";
import { WEATHER_SHOWCASES } from "./weather";
import { VALLEY_LIFE_SHOWCASES } from "./valley-life";
import { SOUND_SHOWCASES } from "./sound";
import { ANIMATIONS_SHOWCASES } from "./animations";
import type { Showcase } from "./types";

export const SHOWCASES: Readonly<Record<string, Showcase>> = {
  ...NATURE_SHOWCASES,
  ...BUILDING_SHOWCASES,
  ...CAMP_SHOWCASES,
  ...INTERFACE_SHOWCASES,
  ...WEATHER_SHOWCASES,
  ...VALLEY_LIFE_SHOWCASES,
  ...SOUND_SHOWCASES,
  ...ANIMATIONS_SHOWCASES,
};
