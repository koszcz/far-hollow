// Every asset showcase, keyed by asset id. Each file holds one family of assets. Add a new asset to the file for its family.
// An animation gets its own file in ./animations and one line in ./animations/registry.ts.
import { NATURE_SHOWCASES } from "./nature";
import { BUILDING_SHOWCASES } from "./building";
import { CAMP_FIRE_SHOWCASES } from "./camp-fire";
import { CAMP_GEAR_SHOWCASES } from "./camp-gear";
import { CAMP_PILE_SHOWCASES } from "./camp-piles";
import { INTERFACE_SHOWCASES } from "./interface";
import { WEATHER_SHOWCASES } from "./weather";
import { VALLEY_LIFE_SHOWCASES } from "./valley-life";
import { SOUND_SHOWCASES } from "./sound";
import { ANIMATIONS_SHOWCASES } from "./animations";
import type { Showcase } from "./types";

/** The camp family: the player's gear, fire and shelter, and things that lie on the ground. */
const CAMP_SHOWCASES: Readonly<Record<string, Showcase>> = { ...CAMP_GEAR_SHOWCASES, ...CAMP_FIRE_SHOWCASES, ...CAMP_PILE_SHOWCASES };

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

/** One family file's showcases, under the name the asset browser groups them by. */
export interface ShowcaseFamily {
  readonly name: string;
  readonly showcases: Readonly<Record<string, Showcase>>;
}

/** Every family file with its name, in the order the asset browser lists them. Each showcase id is in exactly one. */
export const SHOWCASE_FAMILIES: readonly ShowcaseFamily[] = [
  { name: "nature", showcases: NATURE_SHOWCASES },
  { name: "building", showcases: BUILDING_SHOWCASES },
  { name: "camp", showcases: CAMP_SHOWCASES },
  { name: "interface", showcases: INTERFACE_SHOWCASES },
  { name: "weather", showcases: WEATHER_SHOWCASES },
  { name: "valley life", showcases: VALLEY_LIFE_SHOWCASES },
  { name: "sound", showcases: SOUND_SHOWCASES },
  { name: "animations", showcases: ANIMATIONS_SHOWCASES },
];
