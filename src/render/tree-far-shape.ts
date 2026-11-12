// Builds the "far-trees" asset in asset-manifest.json (approved): a cheap stand-in for each tree type, drawn only far
// from the camera, where a tree covers a few dozen pixels. forest-meshes.ts decides where each shape is drawn.
// - The crown is turned around its middle from the real crown's outline. The outline keeps each tier's wide lip and
//   the narrow notch above it, so tiered crowns such as pines still look stepped from afar.
// - The trunk is a few-sided tube as wide as the real trunk's foot, reaching from the ground into the crown.
//   The real trunk often reaches far up inside the crown, with branches, so only its foot is measured.
// - Both parts use the real tree's trunk and crown colours.
import * as THREE from "three";
import type { TreeShape } from "./tree-model";

/** Trees at least this far from the camera, in metres, draw with their far shape. */
export const FAR_TREE_METRES = 150;
/** How many sides the far crown and trunk have. */
const SIDES = 7;
/** How many heights the far crown's outline is measured at, before the outline is simplified. */
const CROWN_BANDS = 32;
/** The simplified crown outline strays from the measured one by at most this share of the crown's widest reach. */
const TIER_STEP = 0.04;
/** A band in a gap between crown clumps reaches at least this share of the clumps around it. */
const GAP_FILL = 0.5;
/** Only trunk points this close to the ground count when measuring how wide the trunk's foot is, in metres. */
const TRUNK_FOOT_BAND_METRES = 0.4;
/** The far trunk reaches this share of the way up into the crown, so no gap shows between them. */
const TRUNK_INTO_CROWN = 0.25;

export interface FarTreeShape {
  readonly trunk: THREE.BufferGeometry;
  readonly crown: THREE.BufferGeometry;
}

export function createFarTreeShape(shape: Pick<TreeShape, "trunk" | "crown">): FarTreeShape {
  return {
    trunk: farTrunk(shape.trunk, boxOf(shape.crown)),
    crown: farCrown(shape.crown),
  };
}

/** A tube as wide as the trunk's foot, from the ground up into the crown. */
function farTrunk(trunk: THREE.BufferGeometry, crown: THREE.Box3): THREE.BufferGeometry {
  const box = boxOf(trunk);
  const foot = box.min.y;
  const middle = new THREE.Vector3(0, foot, 0);
  // The foot's middle, from the points near the ground only.
  const position = trunk.getAttribute("position");
  let count = 0;
  for (const index of usedPoints(trunk)) {
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

/** The crown turned around its middle, following its outline: the tips, and each tier's lip and notch. */
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
  // Some crowns are separate clumps, with gaps between them. A band in a gap reaches at least GAP_FILL of the narrower
  // of the widest bands above and below it, so the far crown stays one solid shape. Notches between tiers stay.
  const filled = reaches.map((reach, index) => {
    const below = Math.max(0, ...reaches.slice(0, index));
    const above = Math.max(0, ...reaches.slice(index + 1));
    return Math.max(reach, Math.min(below, above) * GAP_FILL);
  });
  const points = filled.map((reach, index) => new THREE.Vector2(reach, bottom + band * (index + 0.5)));
  const outline = [new THREE.Vector2(0, bottom), ...keepTierPoints(points, Math.max(...filled)), new THREE.Vector2(0, box.max.y)];
  const geometry = new THREE.LatheGeometry(outline, SIDES);
  geometry.translate(middle.x, 0, middle.z);
  return geometry;
}

/**
 * Drops outline points that lie within `TIER_STEP` of the widest reach from a straight line through their neighbours
 * (Douglas-Peucker). Tier lips and notches stand out from such lines, so they stay. Smooth slopes become few points.
 */
function keepTierPoints(points: THREE.Vector2[], widest: number): THREE.Vector2[] {
  const tolerance = widest * TIER_STEP;
  const keep = points.map((_, index) => index === 0 || index === points.length - 1);
  const split = (from: number, to: number): void => {
    const start = points[from];
    const end = points[to];
    if (start === undefined || end === undefined) return;
    let farthest = -1;
    let distance = tolerance;
    for (let index = from + 1; index < to; index += 1) {
      const point = points[index];
      if (point === undefined) continue;
      const away = distanceFromLine(point, start, end);
      if (away > distance) {
        distance = away;
        farthest = index;
      }
    }
    if (farthest < 0) return;
    keep[farthest] = true;
    split(from, farthest);
    split(farthest, to);
  };
  split(0, points.length - 1);
  return points.filter((_, index) => keep[index]);
}

function distanceFromLine(point: THREE.Vector2, start: THREE.Vector2, end: THREE.Vector2): number {
  const along = end.clone().sub(start);
  const length = along.length();
  if (length === 0) return point.distanceTo(start);
  return Math.abs(along.cross(point.clone().sub(start))) / length;
}

/**
 * The box around the points the geometry's triangles use. In trees.glb a tree's trunk and crown share one list of
 * points, and only the index says which belong to which part, so three.js's own bounding box would cover both.
 */
function boxOf(geometry: THREE.BufferGeometry): THREE.Box3 {
  const position = geometry.getAttribute("position");
  const box = new THREE.Box3();
  const point = new THREE.Vector3();
  for (const index of usedPoints(geometry)) box.expandByPoint(point.fromBufferAttribute(position, index));
  return box;
}

/** The points the geometry's triangles use: those its index names, or every point if it has no index. */
function usedPoints(geometry: THREE.BufferGeometry): Set<number> {
  const index = geometry.getIndex();
  const count = geometry.getAttribute("position").count;
  if (index === null) return new Set(Array.from({ length: count }, (_, at) => at));
  return new Set(Array.from({ length: index.count }, (_, at) => index.getX(at)));
}

/**
 * How far the geometry reaches between two heights from a vertical line through `middle`, in metres. It measures along
 * the triangles' edges, clipped to the heights, so a band between two rings of points still sees the faces crossing it.
 */
function widestReach(geometry: THREE.BufferGeometry, middle: THREE.Vector3, low: number, high: number): number {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const corner = (at: number): number => (index === null ? at : index.getX(at));
  const count = index === null ? position.count : index.count;
  const start = new THREE.Vector3();
  const end = new THREE.Vector3();
  let reach = 0;
  const measure = (point: THREE.Vector3): void => {
    reach = Math.max(reach, Math.hypot(point.x - middle.x, point.z - middle.z));
  };
  for (let triangle = 0; triangle + 2 < count; triangle += 3) {
    for (let side = 0; side < 3; side += 1) {
      start.fromBufferAttribute(position, corner(triangle + side));
      end.fromBufferAttribute(position, corner(triangle + ((side + 1) % 3)));
      if (start.y > end.y) [start.x, start.y, start.z, end.x, end.y, end.z] = [end.x, end.y, end.z, start.x, start.y, start.z];
      if (end.y < low || start.y > high) continue;
      // The reach along a straight edge is largest at one of its ends, so only the clipped ends are measured.
      const rise = end.y - start.y;
      const from = rise === 0 ? 0 : Math.max(0, (low - start.y) / rise);
      const to = rise === 0 ? 1 : Math.min(1, (high - start.y) / rise);
      measure(start.clone().lerp(end, from));
      measure(start.clone().lerp(end, to));
    }
  }
  return reach;
}
