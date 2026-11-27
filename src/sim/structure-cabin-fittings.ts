// What is fitted into a finished cabin: a door, shutters, a fireplace, and a chimney.
// Each goes onto a piece that already stands: a door frame, a window, a foundation, or a fireplace.
import { isOnGridSquare, snapToGridSquare } from "./build-grid";
import { fireplaceOn, hasChimney, nearestBareFireplace } from "./chimneys";
import { doorFrameOn, hasDoor, nearestDoorFrame } from "./doors";
import { edgeMiddle } from "./edge-pieces";
import { blueprintEntities, campfireEntities } from "./entity-queries";
import { unlitFire } from "./fire";
import { foundationOn } from "./foundations";
import { foundationUnderCampfire, hasThingsLyingOn, isClearOfTreesAndStructures } from "./structure-clearance";
import { SHAPES } from "./structure-shapes";
import type { StructureDefinition } from "./structure-types";
import { terrainHeightAt } from "./valley";
import { hasShutters, nearestBareWindow, windowOn } from "./windows";

/** How many planks a door costs. Construction spends one at the start of each stage. */
export const DOOR_PLANK_COST = 3;
/** How long the player holds the build action to build a door, in seconds. */
export const DOOR_BUILD_SECONDS = 6;
/** A door blueprint snaps to the finished door frame whose middle is within this many metres of the mouse. */
const DOOR_SNAP_METRES = 1;

/**
 * A door: planks hung in a finished door frame. It takes the frame's edge and facing, so R does not turn it.
 * It is not an edge piece. The frame keeps holding the edge, and a frame with a door, or a door blueprint, cannot come down.
 * A door never blocks walking, open or shut. Its ground is the frame's line, like the frame's own.
 */
export const door: StructureDefinition & { readonly kind: "door" } = {
  ...SHAPES.door,
  cost: [{ material: "plank", count: DOOR_PLANK_COST }],
  buildSeconds: DOOR_BUILD_SECONDS,
  snap({ entities }, at, turns) {
    const frame = nearestDoorFrame(entities, at, DOOR_SNAP_METRES);
    return frame === undefined ? edgeMiddle(snapToGridSquare(at), turns) : { x: frame.position.x, z: frame.position.z };
  },
  facingAt: ({ entities }, spot, turns) => doorFrameOn(entities, spot)?.facing?.turns ?? turns,
  heightAt: ({ entities, valley }, spot) => doorFrameOn(entities, spot)?.position.y ?? terrainHeightAt(valley.terrain, spot.x, spot.z),
  canPlace: ({ entities }, spot) => doorFrameOn(entities, spot) !== undefined && !hasDoor(entities, spot),
  finish: () => ({ door: true }),
};

/** How many planks shutters cost. Construction spends one at the start of each stage. */
export const SHUTTERS_PLANK_COST = 2;
/** How long the player holds the build action to build shutters, in seconds. */
export const SHUTTERS_BUILD_SECONDS = 4;
/** A shutters blueprint snaps to the finished window with no shutters whose middle is within this many metres of the mouse. */
const SHUTTERS_SNAP_METRES = 1;

/**
 * Shutters: two plank shutters hung in a finished window. They take the window's edge and facing, so R does not turn them.
 * They are not an edge piece. The window keeps holding the edge, and a window with shutters, or a shutters blueprint, cannot come down.
 * Finished shutters start closed. They never block walking, open or closed. Their ground is the window's line, like the window's own.
 */
export const shutters: StructureDefinition & { readonly kind: "shutters" } = {
  ...SHAPES.shutters,
  cost: [{ material: "plank", count: SHUTTERS_PLANK_COST }],
  buildSeconds: SHUTTERS_BUILD_SECONDS,
  snap({ entities }, at, turns) {
    const bare = nearestBareWindow(entities, at, SHUTTERS_SNAP_METRES);
    return bare === undefined ? edgeMiddle(snapToGridSquare(at), turns) : { x: bare.position.x, z: bare.position.z };
  },
  facingAt: ({ entities }, spot, turns) => windowOn(entities, spot)?.facing?.turns ?? turns,
  heightAt: ({ entities, valley }, spot) => windowOn(entities, spot)?.position.y ?? terrainHeightAt(valley.terrain, spot.x, spot.z),
  canPlace: ({ entities }, spot) => windowOn(entities, spot) !== undefined && !hasShutters(entities, spot),
  finish: () => ({ shutters: { open: false } }),
};

/** How many stones a fireplace costs. Construction spends one at the start of each stage. */
export const FIREPLACE_STONE_COST = 12;
/** How long the player holds the build action to build a fireplace, in seconds. */
export const FIREPLACE_BUILD_SECONDS = 24;

/**
 * A fireplace: a low stone fire box with a short chimney, on one finished foundation square. R turns it to face any side of the square.
 * It needs no room around it, so the player can build it before the walls and roof.
 * The square must hold no campfire and no furniture. A fireplace and its blueprint block walking on the square.
 */
export const fireplace: StructureDefinition & { readonly kind: "fireplace" } = {
  ...SHAPES.fireplace,
  cost: [{ material: "stone", count: FIREPLACE_STONE_COST }],
  buildSeconds: FIREPLACE_BUILD_SECONDS,
  snap: (_site, at) => snapToGridSquare(at),
  heightAt: ({ entities, valley }, spot) => foundationOn(entities, spot)?.position.y ?? terrainHeightAt(valley.terrain, spot.x, spot.z),
  canPlace({ entities }, spot, turns) {
    if (foundationUnderCampfire(entities, spot) === undefined) return false;
    const rect = fireplace.footprint(spot, turns);
    // A campfire on the square, finished or as a blueprint, is in the way.
    const fires = [...campfireEntities(entities), ...blueprintEntities(entities).entities.filter(({ blueprint }) => blueprint.structure === "campfire")];
    if (fires.some((fire) => isOnGridSquare(spot, fire.position))) return false;
    // Things lying on the deck would end up under it. The player moves them first.
    // Walls on the square's edges and a roof frame or roof over it are not in the way. Furniture and any other structure are.
    return !hasThingsLyingOn(entities, rect) && isClearOfTreesAndStructures(entities, rect, { ignoreCabinRoofs: true });
  },
  finish: (spot) => ({ fireplace: unlitFire(), blocksWalkingSpots: [{ x: spot.x, z: spot.z }] }),
  blueprintBlocksWalkingSpots: (spot) => [{ x: spot.x, z: spot.z }],
};

/** How many stones a chimney costs. Construction spends one at the start of each stage. */
export const CHIMNEY_STONE_COST = 8;
/** How long the player holds the build action to build a chimney, in seconds. */
export const CHIMNEY_BUILD_SECONDS = 16;
/** A chimney blueprint snaps to the finished fireplace with no chimney whose middle is within this many metres of the mouse. */
const CHIMNEY_SNAP_METRES = 1;

/**
 * A chimney: stone built up from the cap stone of a finished fireplace, through any roof over it. It takes the fireplace's
 * square and facing, so R does not turn it. A fireplace holds one chimney. A chimney is only for looks, and the fireplace
 * already blocks walking on the square, so a chimney blocks nothing more. A roof frame and roof section can go over it.
 */
export const chimney: StructureDefinition & { readonly kind: "chimney" } = {
  ...SHAPES.chimney,
  cost: [{ material: "stone", count: CHIMNEY_STONE_COST }],
  buildSeconds: CHIMNEY_BUILD_SECONDS,
  snap({ entities }, at) {
    const bare = nearestBareFireplace(entities, at, CHIMNEY_SNAP_METRES);
    return bare === undefined ? snapToGridSquare(at) : { x: bare.position.x, z: bare.position.z };
  },
  facingAt: ({ entities }, spot, turns) => fireplaceOn(entities, spot)?.facing?.turns ?? turns,
  heightAt: ({ entities, valley }, spot) => fireplaceOn(entities, spot)?.position.y ?? terrainHeightAt(valley.terrain, spot.x, spot.z),
  canPlace: ({ entities }, spot) => fireplaceOn(entities, spot) !== undefined && !hasChimney(entities, spot),
  placementRefusal({ entities }, spot) {
    if (fireplaceOn(entities, spot) === undefined) return { kind: "chimneyNeedsFireplace" };
    return hasChimney(entities, spot) ? { kind: "fireplaceHasChimney" } : undefined;
  },
  finish: () => ({ chimney: true }),
};
