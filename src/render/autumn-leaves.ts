// The draft "autumn-trees" asset in asset-manifest.json: broadleaf crowns turn amber in autumn, near and far.
// The turn eases in over the first days of autumn, stays through winter, and eases back to green over spring days 1 and 2.
// A spring that no winter came before, such as a new game's first spring, is green from its first day, as it has no snow.
// Conifers keep their green all year. forest-meshes.ts draws the crowns in the colour this file gives.
import * as THREE from "three";
import type { SeasonDay } from "../sim/season";
import { TREE_COLOURS, type TreeTone } from "./tree-model";

/** The colour of a broadleaf crown in each tone once it has fully turned. */
export const AUTUMN_CROWN_COLOURS: Readonly<Record<TreeTone, number>> = { dark: 0x9a5418, light: 0xc98a24 };
/** The leaves take this many days, from the start of autumn, to turn fully amber. */
const TURN_DAYS = 3;
/** The leaves take this many days, from the start of spring, to turn back to green. */
const GREEN_AGAIN_DAYS = 2;

/**
 * How far the broadleaf crowns have turned on this day at this hour, from 0 (summer green) to 1 (fully amber).
 * `afterWinter` says whether a winter came before this day (see isAfterFirstWinter). Without one, spring leaves are green.
 */
export function leafTurnShare(seasonDay: SeasonDay, hourOfDay: number, { afterWinter }: { afterWinter: boolean }): number {
  const daysIn = seasonDay.dayOfSeason - 1 + hourOfDay / 24;
  switch (seasonDay.season) {
    case "summer":
      return 0;
    case "autumn":
      return THREE.MathUtils.smoothstep(daysIn, 0, TURN_DAYS);
    case "winter":
      return 1;
    case "spring":
      return afterWinter ? 1 - THREE.MathUtils.smoothstep(daysIn, 0, GREEN_AGAIN_DAYS) : 0;
  }
}

/** Whether a tree type from trees.glb, such as "tree_oak", drops its leaves. The pines are conifers. */
export function isBroadleaf(treeName: string): boolean {
  return !treeName.includes("pine");
}

/** The colour of a broadleaf crown in this tone, `share` of the way from summer green to autumn amber. */
export function crownColour(tone: TreeTone, share: number, out = new THREE.Color()): THREE.Color {
  return out.set(TREE_COLOURS.crown[tone]).lerp(new THREE.Color(AUTUMN_CROWN_COLOURS[tone]), share);
}
