// The "autumn-trees" asset in asset-manifest.json, approved by the owner: broadleaf crowns turn to autumn colours, near and far.
// Each broadleaf type has its own colour: the oak turns rust red, the default tree orange, the detailed tree gold, and the tall tree yellow.
// The turn eases in over the first days of autumn, stays through winter, and eases back to green over spring days 1 and 2.
// A spring that no winter came before, such as a new game's first spring, is green from its first day, as it has no snow.
// Conifers keep their green all year. forest-meshes.ts draws the crowns in the colour this file gives.
import * as THREE from "three";
import type { SeasonDay } from "../sim/season";
import { TREE_COLOURS, type TreeShape } from "./tree-model";

/** The colour of each broadleaf type's crown once it has fully turned, by its name in trees.glb. */
export const AUTUMN_CROWN_COLOURS = {
  tree_oak: 0xb8481e,
  tree_default: 0xd9741c,
  tree_detailed: 0xe0a526,
  tree_tall: 0xf0b428,
} as const satisfies Readonly<Record<string, number>>;
/** The autumn colour of a broadleaf type that AUTUMN_CROWN_COLOURS does not name. */
export const AUTUMN_CROWN_FALLBACK = 0xd9741c;
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

/** The colour a broadleaf type's crown has once it has fully turned. */
export function autumnColourOf(treeName: string): number {
  return (AUTUMN_CROWN_COLOURS as Readonly<Record<string, number>>)[treeName] ?? AUTUMN_CROWN_FALLBACK;
}

/** The colour of a broadleaf type's crown, `share` of the way from its summer green to its autumn colour. */
export function crownColour(shape: Pick<TreeShape, "name" | "crownTone">, share: number, out = new THREE.Color()): THREE.Color {
  return out.set(TREE_COLOURS.crown[shape.crownTone]).lerp(new THREE.Color(autumnColourOf(shape.name)), share);
}
