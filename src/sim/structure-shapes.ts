// The shape of every structure: its kind, placement, finished marker, and the ground it covers.
// Each structure's own file adds its cost, placement rule, and finished form to its shape.
// The rules that look at other structures read only shapes, so a structure's file can use them without a loop of imports.
import { BUILD_GRID_METRES } from "./build-grid";
import { FURNITURE, type FurnitureDefinition } from "./furniture";
import { FURNITURE_KINDS, turnedRect, type FurnitureKind, type StructureKind } from "./structure-kind";
import type { StructureShape } from "./structure-types";

/** A finished campfire stops the player walking within this many metres of its centre. A campfire's ground is the square that radius reaches. */
export const CAMPFIRE_WALK_BLOCK_RADIUS_METRES = 0.8;
/** A lean-to is this wide across its open front, in metres. */
export const LEAN_TO_WIDTH_METRES = 4;
/** A lean-to is this deep from its open front to its back, in metres. */
export const LEAN_TO_DEPTH_METRES = 2;
/** A foundation covers one building-grid square. */
export const FOUNDATION_HALF_METRES = 0.5;
/** A woodpile covers this much ground either side of its centre, in metres: about one log's length across. */
const WOODPILE_HALF_METRES = 0.5;
/** A sawhorse is this long, along its beam, in metres. */
export const SAWHORSE_LENGTH_METRES = 1.2;
/** A sawhorse's legs spread this far apart at the foot, across its beam, in metres. */
export const SAWHORSE_WIDTH_METRES = 0.6;
/** A sled is this long, along its runners, in metres. */
export const SLED_LENGTH_METRES = 1.8;
/** A sled is this wide, across its runners, in metres. */
export const SLED_WIDTH_METRES = 0.8;

/** The ground a log wall, door frame, window, door, or shutters covers: the line along its edge, so it never overlaps the squares on either side. */
const edgeFootprint: StructureShape["footprint"] = (spot, turns) => turnedRect(spot, BUILD_GRID_METRES / 2, 0, turns);
/** The ground a structure covers when it fills one foundation square. */
const squareFootprint: StructureShape["footprint"] = (spot, turns) => turnedRect(spot, FOUNDATION_HALF_METRES, FOUNDATION_HALF_METRES, turns);

/** The shape of a piece of furniture. Every piece is placed anywhere, and covers its own size. */
export function furnitureShape<Kind extends FurnitureKind>(piece: FurnitureDefinition<Kind>): StructureShape<Kind> {
  return {
    kind: piece.kind,
    placement: "anywhere",
    finishedAs: "furniture",
    footprint: (spot, turns) => turnedRect(spot, piece.size.x / 2, piece.size.z / 2, turns),
  };
}

/** Each piece of furniture's shape, by its kind. */
const FURNITURE_SHAPES = Object.fromEntries(FURNITURE_KINDS.map((kind) => [kind, furnitureShape(FURNITURE[kind])])) as {
  readonly [Kind in FurnitureKind]: StructureShape<Kind>;
};

/** Each structure's shape by its kind. TypeScript reports a kind with no entry. The build menu lists them in this order. */
export const SHAPES: { readonly [Kind in StructureKind]: StructureShape<Kind> } = {
  campfire: {
    kind: "campfire",
    placement: "onGround",
    finishedAs: "campfire",
    footprint: (spot, turns) => turnedRect(spot, CAMPFIRE_WALK_BLOCK_RADIUS_METRES, CAMPFIRE_WALK_BLOCK_RADIUS_METRES, turns),
  },
  leanTo: {
    kind: "leanTo",
    placement: "onGround",
    finishedAs: "leanTo",
    footprint: (spot, turns) => turnedRect(spot, LEAN_TO_WIDTH_METRES / 2, LEAN_TO_DEPTH_METRES / 2, turns),
  },
  foundation: { kind: "foundation", placement: "onGround", finishedAs: "foundation", footprint: squareFootprint },
  floor: { kind: "floor", placement: "underfoot", fixedFacing: true, finishedAs: "floor", footprint: squareFootprint },
  logWall: { kind: "logWall", placement: "onEdge", finishedAs: "edgePiece", footprint: edgeFootprint },
  doorFrame: { kind: "doorFrame", placement: "onEdge", finishedAs: "edgePiece", footprint: edgeFootprint },
  window: { kind: "window", placement: "onEdge", finishedAs: "edgePiece", footprint: edgeFootprint },
  roofFrame: { kind: "roofFrame", placement: "overWalls", finishedAs: "roofFrame", footprint: squareFootprint },
  roof: { kind: "roof", placement: "onFrame", fixedFacing: true, finishedAs: "cabinRoof", footprint: squareFootprint },
  door: { kind: "door", placement: "inDoorFrame", fixedFacing: true, finishedAs: "door", footprint: edgeFootprint },
  shutters: { kind: "shutters", placement: "inWindow", fixedFacing: true, finishedAs: "shutters", footprint: edgeFootprint },
  fireplace: { kind: "fireplace", placement: "onFoundation", finishedAs: "fireplace", footprint: squareFootprint },
  chimney: { kind: "chimney", placement: "onFireplace", fixedFacing: true, finishedAs: "chimney", footprint: squareFootprint },
  woodpile: {
    kind: "woodpile",
    placement: "onGround",
    finishedAs: "woodpile",
    footprint: (spot, turns) => turnedRect(spot, WOODPILE_HALF_METRES, WOODPILE_HALF_METRES, turns),
  },
  ...FURNITURE_SHAPES,
  sawhorse: {
    kind: "sawhorse",
    placement: "onGround",
    finishedAs: "workStation",
    footprint: (spot, turns) => turnedRect(spot, SAWHORSE_LENGTH_METRES / 2, SAWHORSE_WIDTH_METRES / 2, turns),
  },
  sled: {
    kind: "sled",
    placement: "anywhere",
    finishedAs: "sled",
    footprint: (spot, turns) => turnedRect(spot, SLED_LENGTH_METRES / 2, SLED_WIDTH_METRES / 2, turns),
  },
};
