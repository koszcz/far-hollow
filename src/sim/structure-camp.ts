// The structures a camp is made of: a campfire, a lean-to, a woodpile, and a sawhorse.
// Each stands on open ground, on a grid point, off the building grid's walls.
import { isOnGridSquare, snapToGridPoint, snapToGridSquare } from "./build-grid";
import { blueprintEntities, campfireEntities, fireplaceEntities, woodpileEntities, workStationEntities, type Entity } from "./entities";
import { foundationOn } from "./foundations";
import { addGroundPoints, groundDistance, type GroundPoint } from "./ground-point";
import { roomAround } from "./rooms";
import { turnOffset, turnQuarters, type QuarterTurns } from "./quarter-turns";
import { rectsOverlap } from "./structure-kind";
import { foundationUnderCampfire, isClearFor, isClearOfFreelyPlaced, overlapsCabinPiece } from "./structure-clearance";
import { isPlacedFreely, liesUnderfoot } from "./structure-queries";
import { CAMPFIRE_WALK_BLOCK_RADIUS_METRES, LEAN_TO_DEPTH_METRES, SHAPES } from "./structure-shapes";
import type { StructureDefinition } from "./structure-types";
import { terrainHeightAt } from "./valley";
import { isWalkable } from "./walk-map";

/** How many sticks a campfire costs. Construction spends one at the start of each stage. */
export const CAMPFIRE_STICK_COST = 5;
/** How long the player holds the build action to build a campfire, in seconds. */
export const CAMPFIRE_BUILD_SECONDS = 5;
/** Two campfires, finished or not, cannot be closer than this, in metres. */
const CAMPFIRE_MIN_SPACING_METRES = 2;

/**
 * A campfire. On open ground it sits on a grid point.
 * Inside a room it stands on a foundation, in the middle of the square, so it can warm the whole room.
 */
export const campfire: StructureDefinition & { readonly kind: "campfire" } = {
  ...SHAPES.campfire,
  cost: [{ material: "stick", count: CAMPFIRE_STICK_COST }],
  buildSeconds: CAMPFIRE_BUILD_SECONDS,
  snap({ entities }, at) {
    const square = snapToGridSquare(at);
    return foundationOn(entities, square) === undefined ? snapToGridPoint(at) : square;
  },
  heightAt: ({ entities, valley }, spot) => foundationUnderCampfire(entities, spot)?.position.y ?? terrainHeightAt(valley.terrain, spot.x, spot.z),
  canPlace({ entities, walkMap }, spot, turns) {
    if (!isWalkable(walkMap, spot)) return false;
    if (foundationUnderCampfire(entities, spot) === undefined) {
      // On open ground, a campfire keeps clear of every foundation, wall, door frame, and roof section, finished or as a blueprint.
      if (overlapsCabinPiece(entities, campfire.footprint(spot, turns))) return false;
    } else if (roomAround(entities, spot) === undefined) {
      // On a foundation, a campfire goes only inside a room.
      return false;
    }
    // A fireplace's square holds no campfire.
    if (fireplaceEntities(entities).entities.some((fireplace) => isOnGridSquare(fireplace.position, spot))) return false;
    const plans = blueprintEntities(entities).entities.filter(({ blueprint }) => !isPlacedFreely(blueprint.structure) && !liesUnderfoot(blueprint.structure));
    for (const other of [...campfireEntities(entities), ...plans, ...woodpileEntities(entities), ...workStationEntities(entities)]) {
      if (groundDistance(other.position, spot) < CAMPFIRE_MIN_SPACING_METRES) return false;
    }
    return isClearOfFreelyPlaced(entities, campfire.footprint(spot, 0));
  },
  finish(spot, _turns, entities) {
    const finished: Entity = { campfire: { lit: false, fuelMinutes: 0 }, blocksWalking: { radius: CAMPFIRE_WALK_BLOCK_RADIUS_METRES } };
    if (foundationUnderCampfire(entities, spot) !== undefined) finished.onFoundation = { x: spot.x, z: spot.z };
    return finished;
  },
};

/** How many sticks a lean-to's frame costs. */
export const LEAN_TO_STICK_COST = 10;
/** How much bark a lean-to's roof costs. */
export const LEAN_TO_BARK_COST = 6;
/** How long the player holds the build action to build a lean-to, in seconds. */
export const LEAN_TO_BUILD_SECONDS = 20;
/**
 * The middles of the 1 m squares a finished lean-to's frame blocks, as offsets from its centre when it faces the default way.
 * Facing the default way, its open front faces +z. Its back row and the two front corners block walking.
 * The two middle front squares stay open, so the player walks in at the front and stands under the roof.
 */
const LEAN_TO_BLOCKED_SQUARES: readonly GroundPoint[] = [
  { x: -1.5, z: -0.5 },
  { x: -0.5, z: -0.5 },
  { x: 0.5, z: -0.5 },
  { x: 1.5, z: -0.5 },
  { x: -1.5, z: 0.5 },
  { x: 1.5, z: 0.5 },
];

/**
 * Where a bedroll laid in a lean-to lies: across the middle of its open front, along its width, under the roof.
 * That strip is the part of the lean-to the player can walk on. `spot` and `turns` are the lean-to's middle and facing.
 * Returns the bedroll's middle and which way it faces. A bedroll facing the default way lies along z, so it turns a quarter more.
 */
export function leanToBedrollSpot(spot: GroundPoint, turns: QuarterTurns): { spot: GroundPoint; turns: QuarterTurns } {
  const offset = turnOffset({ x: 0, z: LEAN_TO_DEPTH_METRES / 4 }, turns);
  return { spot: addGroundPoints(spot, offset), turns: turnQuarters(turns, 1) };
}

export const leanTo: StructureDefinition & { readonly kind: "leanTo" } = {
  ...SHAPES.leanTo,
  cost: [
    { material: "stick", count: LEAN_TO_STICK_COST },
    { material: "bark", count: LEAN_TO_BARK_COST },
  ],
  buildSeconds: LEAN_TO_BUILD_SECONDS,
  canPlace(site, spot, turns) {
    return isClearFor(site, leanTo.footprint(spot, turns));
  },
  finish: (spot, turns) => ({
    leanTo: true,
    roof: leanTo.footprint(spot, turns),
    blocksWalkingSpots: LEAN_TO_BLOCKED_SQUARES.map((offset) => addGroundPoints(spot, turnOffset(offset, turns))),
  }),
};

/** How long the player holds the build action to build a woodpile, in seconds. It costs nothing, so it goes up quickly. */
export const WOODPILE_BUILD_SECONDS = 3;
/**
 * A finished woodpile stops the player walking within this many metres of its centre.
 * It sits on a grid point, where four 1 m walk-map cells meet, so this reaches the centres of all four.
 */
export const WOODPILE_WALK_BLOCK_RADIUS_METRES = 0.75;

/**
 * A woodpile: logs, debarked logs, and firewood stacked on two rails on the ground. It costs nothing.
 * It sits on a grid point, like a campfire on open ground. It is never built on a foundation.
 */
export const woodpile: StructureDefinition & { readonly kind: "woodpile" } = {
  ...SHAPES.woodpile,
  cost: [],
  buildSeconds: WOODPILE_BUILD_SECONDS,
  canPlace(site, spot, turns) {
    const rect = woodpile.footprint(spot, turns);
    if (!isWalkable(site.walkMap, spot)) return false;
    for (const fire of campfireEntities(site.entities)) if (rectsOverlap(rect, campfire.footprint(fire.position, 0))) return false;
    return isClearFor(site, rect);
  },
  finish: () => ({ woodpile: { log: 0, debarkedLog: 0, firewood: 0 }, blocksWalking: { radius: WOODPILE_WALK_BLOCK_RADIUS_METRES } }),
};

/** How many debarked logs a sawhorse costs: one for its legs and one for the beam across them. */
export const SAWHORSE_LOG_COST = 2;
/** How long the player holds the build action to build a sawhorse, in seconds. */
export const SAWHORSE_BUILD_SECONDS = 8;
/**
 * A finished sawhorse stops the player walking within this many metres of its centre.
 * It sits on a grid point, where four 1 m walk-map cells meet, so this reaches the centres of all four.
 */
export const SAWHORSE_WALK_BLOCK_RADIUS_METRES = 0.75;

/**
 * A sawhorse: the first work station. A beam of debarked log rests on two pairs of crossed legs.
 * It sits on a grid point on the ground, like a woodpile, and R turns it. It is not a building piece, so it needs no foundation.
 */
export const sawhorse: StructureDefinition & { readonly kind: "sawhorse" } = {
  ...SHAPES.sawhorse,
  cost: [{ material: "debarkedLog", count: SAWHORSE_LOG_COST }],
  buildSeconds: SAWHORSE_BUILD_SECONDS,
  canPlace(site, spot, turns) {
    const rect = sawhorse.footprint(spot, turns);
    // The sawhorse reaches into each of the four walk-map cells that meet at its grid point, and each corner lies in one of them.
    const corners = [rect.min, rect.max, { x: rect.min.x, z: rect.max.z }, { x: rect.max.x, z: rect.min.z }];
    for (const corner of [spot, ...corners]) if (!isWalkable(site.walkMap, corner)) return false;
    for (const fire of campfireEntities(site.entities)) if (rectsOverlap(rect, campfire.footprint(fire.position, 0))) return false;
    return isClearFor(site, rect);
  },
  finish: () => ({ workStation: "sawhorse", blocksWalking: { radius: SAWHORSE_WALK_BLOCK_RADIUS_METRES } }),
};
