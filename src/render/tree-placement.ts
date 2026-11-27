// Where and how a tree is drawn at a spot: its size and turn, its type, its stump's fit, and the steady look value they come from.
// Everything here only affects drawing. The simulation owns where trees are and how big they are.
import * as THREE from "three";
import { treeLookAt, treeSizeAt } from "../sim/tree-size";
import type { GroundPoint } from "../sim/ground-point";
import { isSapling, isYoungTree } from "../sim/tree-growth";
import type { Entity, Vec3 } from "../sim/entities";
import type { StumpShape } from "./stump-model";
import type { TreeShape } from "./tree-model";

/** How often each tree type grows, relative to the others. Pines fill most of the valley. Unlisted types get 1. */
const TREE_TYPE_WEIGHTS: Readonly<Record<string, number>> = {
  tree_pineDefaultA: 4,
  tree_pineDefaultB: 4,
  tree_pineTallA: 3,
  tree_pineRoundA: 2,
};
/** A stump never stands taller than this above the ground, before the tree's own size, so wide oaks leave low stumps. */
const STUMP_MAX_HEIGHT_METRES = 0.6;
/** Only trunk points this close to the ground count when measuring how wide a trunk's foot is, in metres. */
const TRUNK_FOOT_BAND_METRES = 0.4;

/** What a click on a drawn tree lands on: a standing tree, a young tree, or a sapling. Undefined for anything else, such as a bare stump. */
export function standingKindOf(tree: Entity): "tree" | "youngTree" | "sapling" | undefined {
  if (tree.tree === true) return "tree";
  if (isYoungTree(tree.growth)) return "youngTree";
  return isSapling(tree.growth) ? "sapling" : undefined;
}
const treeRotation = new THREE.Quaternion();
const treeScale = new THREE.Vector3();
const treePosition = new THREE.Vector3();
const upAxis = new THREE.Vector3(0, 1, 0);

/** The size and turn a tree is drawn with at a spot. The size comes from the simulation, since it sets how many logs the tree gives. `sizeAt` overrides the spot the size and turn come from. */
export function treeMatrix(at: Vec3 & { sizeAt?: GroundPoint }, out: THREE.Matrix4): THREE.Matrix4 {
  const from = at.sizeAt ?? at;
  treeRotation.setFromAxisAngle(upAxis, treeLookAt(from.x, from.z) * Math.PI * 2);
  treeScale.setScalar(treeSizeAt(from.x, from.z));
  treePosition.set(at.x, at.y, at.z);
  return out.compose(treePosition, treeRotation, treeScale);
}

/** The tree type drawn at a spot, picked by TREE_TYPE_WEIGHTS. It only affects drawing. */
export function treeTypeFor(x: number, z: number, shapes: readonly TreeShape[]): number {
  const weights = shapes.map((shape) => TREE_TYPE_WEIGHTS[shape.name] ?? 1);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  // Offset the spot, so a tree's type does not follow its size.
  let roll = lookFor(x + 31.7, z - 17.3) * total;
  for (const [type, weight] of weights.entries()) {
    roll -= weight;
    if (roll < 0) return type;
  }
  return shapes.length - 1;
}

/**
 * Scales the stump model so its foot is as wide as a trunk's foot, in metres.
 * The height grows with the width, up to STUMP_MAX_HEIGHT_METRES.
 */
export function stumpFit(trunk: THREE.BufferGeometry, stump: StumpShape): THREE.Matrix4 {
  const position = trunk.getAttribute("position");
  let bottom = Infinity;
  for (let i = 0; i < position.count; i += 1) bottom = Math.min(bottom, position.getY(i));
  let footRadius = 0;
  for (let i = 0; i < position.count; i += 1) {
    if (position.getY(i) - bottom > TRUNK_FOOT_BAND_METRES) continue;
    footRadius = Math.max(footRadius, Math.hypot(position.getX(i), position.getZ(i)));
  }
  const across = footRadius / stump.footRadius;
  const up = Math.min(across, STUMP_MAX_HEIGHT_METRES / stump.height);
  return new THREE.Matrix4().makeScale(across, up, across);
}

/** A steady value from 0 to 1 for a spot, used to vary sticks and pick tree types. It only affects drawing. */
export function lookFor(x: number, z: number): number {
  const value = Math.sin(x * 12.9898 + z * 78.233) * 43_758.5453;
  return value - Math.floor(value);
}
