// Builds the "far-trees" asset in asset-manifest.json (draft): a cheap stand-in for each tree type, drawn only far
// from the camera, where a tree covers a few dozen pixels. forest-meshes.ts decides where each shape is drawn.
// - The crown is turned around its middle from the real crown's outline: its widest reach at a few heights.
// - The trunk is a few-sided tube as wide as the real trunk's foot, reaching from the ground into the crown.
//   The real trunk often reaches far up inside the crown, with branches, so only its foot is measured.
// - Both parts use the real tree's trunk and crown colours.
import * as THREE from "three";
import type { TreeShape } from "./tree-model";

/** Trees at least this far from the camera, in metres, draw with their far shape. */
export const FAR_TREE_METRES = 150;
/** How many sides the far crown and trunk have. */
const SIDES = 7;
/** How many heights the far crown's outline is measured at. */
const CROWN_BANDS = 6;
/** Only trunk points this close to the ground count when measuring how wide the trunk's foot is, in metres. */
const TRUNK_FOOT_BAND_METRES = 0.4;
/** The far trunk reaches this share of the way up into the crown, so no gap shows between them. */
const TRUNK_INTO_CROWN = 0.25;

export interface FarTreeShape {
  readonly trunk: THREE.BufferGeometry;
  readonly crown: THREE.BufferGeometry;
}

export function createFarTreeShape(shape: Pick<TreeShape, "trunk" | "crown">): FarTreeShape {
  return { trunk: farTrunk(shape.trunk, boxOf(shape.crown)), crown: farCrown(shape.crown) };
}

/** A tube as wide as the trunk's foot, from the ground up into the crown. */
function farTrunk(trunk: THREE.BufferGeometry, crown: THREE.Box3): THREE.BufferGeometry {
  const box = boxOf(trunk);
  const foot = box.min.y;
  const middle = new THREE.Vector3(0, foot, 0);
  // The foot's middle, from the points near the ground only.
  const position = trunk.getAttribute("position");
  let count = 0;
  for (let index = 0; index < position.count; index += 1) {
    if (position.getY(index) - foot > TRUNK_FOOT_BAND_METRES) continue;
    middle.x += position.getX(index);
    middle.z += position.getZ(index);
    count += 1;
  }
  if (count > 0) middle.set(middle.x / count, foot, middle.z / count);
  const radius = widestReach(trunk, middle, foot, foot + TRUNK_FOOT_BAND_METRES);
  const top = Math.max(foot, crown.min.y + (crown.max.y - crown.min.y) * TRUNK_INTO_CROWN);
  const height = top - foot;
  const geometry = new THREE.CylinderGeometry(radius * 0.7, radius, height, SIDES, 1, true);
  geometry.translate(middle.x, foot + height / 2, middle.z);
  return geometry;
}

/** The crown turned around its middle, following its widest reach at CROWN_BANDS heights. */
function farCrown(crown: THREE.BufferGeometry): THREE.BufferGeometry {
  const box = boxOf(crown);
  const middle = box.getCenter(new THREE.Vector3());
  const bottom = box.min.y;
  const band = (box.max.y - bottom) / CROWN_BANDS;
  const reaches: number[] = [];
  for (let index = 0; index < CROWN_BANDS; index += 1) {
    const low = bottom + band * index;
    reaches.push(widestReach(crown, middle, low, low + band));
  }
  // Some crowns are separate clumps, with gaps between them. A band in a gap reaches no further than the widest bands
  // above and below it, so the far crown stays one solid shape.
  const filled = reaches.map((reach, index) => {
    const below = Math.max(0, ...reaches.slice(0, index));
    const above = Math.max(0, ...reaches.slice(index + 1));
    return Math.max(reach, Math.min(below, above));
  });
  const outline = [new THREE.Vector2(0, bottom)];
  filled.forEach((reach, index) => {
    outline.push(new THREE.Vector2(reach, bottom + band * (index + 0.5)));
  });
  outline.push(new THREE.Vector2(0, box.max.y));
  const geometry = new THREE.LatheGeometry(outline, SIDES);
  geometry.translate(middle.x, 0, middle.z);
  return geometry;
}

function boxOf(geometry: THREE.BufferGeometry): THREE.Box3 {
  geometry.computeBoundingBox();
  return geometry.boundingBox?.clone() ?? new THREE.Box3();
}

/** How far the geometry's points between two heights reach from a vertical line through `middle`, in metres. */
function widestReach(geometry: THREE.BufferGeometry, middle: THREE.Vector3, low: number, high: number): number {
  const position = geometry.getAttribute("position");
  let reach = 0;
  for (let index = 0; index < position.count; index += 1) {
    const y = position.getY(index);
    if (y < low || y > high) continue;
    reach = Math.max(reach, Math.hypot(position.getX(index) - middle.x, position.getZ(index) - middle.z));
  }
  return reach;
}
