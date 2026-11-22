// Decides where undergrowth grows and what kind grows there. It draws nothing: undergrowth-meshes.ts draws the plants.
// What grows depends on the ground type at each spot, from src/sim/ground-types.ts. Where forest floor blends into clearing,
// each plant has its own share of forest floor at which it turns from one kind to the other. As the ground changes, ferns
// thin out one by one as grass and flowers move in, or the reverse. A plant shrinks into the ground before it turns, so none pops.
// Undergrowth is only for looks. Game logic never sees it, it is never saved, and it never blocks the way.
// The valley is split into square patches. Each patch grows from its own seed, made from the valley's seed and the patch,
// so the same seed always grows the same undergrowth in the same spots, however the camera moves.
import { groundTypeAt, groundTypeWeightsAt, type GroundMap, type GroundType } from "../sim/ground-types";
import { createRandom } from "../sim/random";
import { distanceToRiver } from "../sim/valley";

export type UndergrowthKind = "fern" | "smallRock" | "sparseGrass" | "grassTuft" | "flower" | "stone" | "tallGrass" | "flatPebble";

/** One plant or stone on the ground. */
export interface UndergrowthItem {
  readonly kind: UndergrowthKind;
  /** Where it stands, in metres from the valley's centre. */
  readonly x: number;
  readonly z: number;
  /** How far it is turned about the upright axis, in radians. */
  readonly turn: number;
  /** How much bigger or smaller than usual it is. 1 is the usual size. */
  readonly size: number;
  /** A number from 0 up to 1 that picks which model of its kind it uses. */
  readonly look: number;
}

/** Each patch of ground is a square this wide, in metres, counted from the valley's edge at x = -size / 2, z = -size / 2. */
export const UNDERGROWTH_PATCH_METRES = 8;

/** How many spots per square metre are tried. Each spot grows at most one plant. */
const SPOTS_PER_SQUARE_METRE = 1;

/** For each ground type, the chance that a tried spot grows each kind. The chances on one ground type add up to at most 1. */
const GROWTH_CHANCES: Readonly<Record<GroundType, readonly { kind: UndergrowthKind; chance: number }[]>> = {
  forestFloor: [
    { kind: "fern", chance: 0.22 },
    { kind: "smallRock", chance: 0.04 },
    { kind: "sparseGrass", chance: 0.08 },
  ],
  clearing: [
    { kind: "grassTuft", chance: 0.45 },
    { kind: "flower", chance: 0.06 },
    { kind: "stone", chance: 0.008 },
  ],
  riverBank: [
    { kind: "tallGrass", chance: 0.25 },
    { kind: "flatPebble", chance: 0.3 },
  ],
};

/** How much a plant's size may vary each way from the usual size. 0.3 means from 0.7 to 1.3 times. */
const SIZE_SPREAD = 0.3;

/** Each plant turns from forest floor kind to clearing kind at its own share of forest floor, picked from this range. */
const TURN_SHARE_LOWEST = 0.2;
const TURN_SHARE_HIGHEST = 0.8;
/** A plant shrinks to nothing as the share of forest floor nears its turning share, from this far either side. */
const TURN_SHRINK_SHARE = 0.08;
/** A plant smaller than this share of its usual size is left out. */
const SMALLEST_SIZE = 0.02;

/** Grows the undergrowth on one patch of ground. The same seed and patch always give the same plants. */
export function growUndergrowthPatch(seed: number, map: GroundMap, column: number, row: number): UndergrowthItem[] {
  const random = createRandom(patchSeed(seed, column, row));
  const left = column * UNDERGROWTH_PATCH_METRES - map.size / 2;
  const top = row * UNDERGROWTH_PATCH_METRES - map.size / 2;
  const tries = Math.round(UNDERGROWTH_PATCH_METRES * UNDERGROWTH_PATCH_METRES * SPOTS_PER_SQUARE_METRE);
  const plants: UndergrowthItem[] = [];
  for (let i = 0; i < tries; i += 1) {
    // Every try uses the same five random numbers, grown or not, so one spot never shifts the next.
    const x = left + random() * UNDERGROWTH_PATCH_METRES;
    const z = top + random() * UNDERGROWTH_PATCH_METRES;
    const roll = random();
    const turn = random() * Math.PI * 2;
    const size = 1 - SIZE_SPREAD + random() * SIZE_SPREAD * 2;
    const look = random();
    const { groundType, shrink } = groundTypeFor(map, { x, z }, look);
    const kind = kindFor(groundType, roll);
    if (kind === undefined || shrink < SMALLEST_SIZE) continue;
    // River bank reaches into the water, but nothing grows under it.
    if (groundType === "riverBank" && distanceToRiver(map.river, { x, z }) < map.river.width / 2) continue;
    plants.push({ kind, x, z, turn, size: size * shrink, look });
  }
  return plants;
}

/**
 * The ground type a plant at this spot grows as, and how much of its size it has, from 0 to 1.
 * On river bank, the plant is river bank kind at full size. Elsewhere it turns from forest floor kind to clearing kind
 * where the share of forest floor passes its own turning share, picked from `look`, and it shrinks to nothing on the way.
 */
function groundTypeFor(map: GroundMap, spot: { x: number; z: number }, look: number): { groundType: GroundType; shrink: number } {
  const groundType = groundTypeAt(map, spot);
  if (groundType === "riverBank") return { groundType, shrink: 1 };
  const weights = groundTypeWeightsAt(map, spot);
  const share = weights.forestFloor / Math.max(weights.forestFloor + weights.clearing, Number.EPSILON);
  // A spread of `look` that does not follow which model it picks.
  const spread = (look * 97.13) % 1;
  const turnShare = TURN_SHARE_LOWEST + spread * (TURN_SHARE_HIGHEST - TURN_SHARE_LOWEST);
  const t = Math.min(1, Math.abs(share - turnShare) / TURN_SHRINK_SHARE);
  return { groundType: share > turnShare ? "forestFloor" : "clearing", shrink: t * t * (3 - 2 * t) };
}

/** The kind a tried spot grows on this ground type, or undefined when nothing grows there. */
function kindFor(groundType: GroundType, roll: number): UndergrowthKind | undefined {
  let reached = 0;
  for (const { kind, chance } of GROWTH_CHANCES[groundType]) {
    reached += chance;
    if (roll < reached) return kind;
  }
  return undefined;
}

/** Mixes the valley's seed with a patch's place into one seed, so neighbouring patches grow differently. */
function patchSeed(seed: number, column: number, row: number): number {
  let hash = seed >>> 0;
  hash = Math.imul(hash ^ (column + 0x9e3779b9), 0x85ebca6b) >>> 0;
  hash = Math.imul(hash ^ (row + 0x7f4a7c15), 0xc2b2ae35) >>> 0;
  return (hash ^ (hash >>> 16)) >>> 0;
}
