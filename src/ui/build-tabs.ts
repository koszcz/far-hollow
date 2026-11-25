// The build menu's tabs: Camp, Shelter, and Furniture. The menu shows the rows of one tab at a time.
// Which tab lists a structure is a UI choice, so it lives here, not in the game logic.
import type { BuildMenuEntry, BuildMenuKind } from "../sim/api";

/** The build menu's tabs, in the order the menu shows them. */
export const BUILD_TABS = ["camp", "shelter", "furniture"] as const;
export type BuildTab = (typeof BUILD_TABS)[number];

/** The tab the build menu opens on the first time. */
export const FIRST_BUILD_TAB: BuildTab = "camp";

/** The tab that lists each structure in the build menu. TypeScript reports a structure with no tab. */
const TAB_OF: Readonly<Record<BuildMenuKind, BuildTab>> = {
  campfire: "camp",
  leanTo: "camp",
  woodpile: "camp",
  sawhorse: "camp",
  sled: "camp",
  foundation: "shelter",
  floor: "shelter",
  logWall: "shelter",
  doorFrame: "shelter",
  window: "shelter",
  roofFrame: "shelter",
  fireplace: "shelter",
  chest: "furniture",
  shelf: "furniture",
  bed: "furniture",
  table: "furniture",
  stool: "furniture",
  rainBarrel: "furniture",
};

/** The build menu's rows in one tab, in the order the game lists them. */
export function entriesInTab(entries: readonly BuildMenuEntry[], tab: BuildTab): readonly BuildMenuEntry[] {
  return entries.filter(({ structure }) => TAB_OF[structure] === tab);
}
