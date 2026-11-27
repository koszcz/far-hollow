// The shape of a door frame: two tapering, leaning posts with a lintel across the top, each a debarked log with paler cut ends.
import * as THREE from "three";
import { BUILD_GRID_METRES } from "../sim/build-grid";
import { DEBARKED_LOG_COLOUR, DEBARKED_LOG_CUT_COLOUR } from "./debarked-log-shape";
import { EDGE_PIECE_HEIGHT_METRES } from "./log-courses";

/** A door post is a little thicker at the foot than at the top, like the trunk it was cut from. */
export const POST_FOOT_RADIUS_METRES = 0.125;
export const POST_TOP_RADIUS_METRES = 0.11;
export const LINTEL_RADIUS_METRES = 0.11;
/** How wide the doorway is between the feet of a door frame's posts, in metres. A door hung in it fits this gap. */
export const DOORWAY_WIDTH_METRES = BUILD_GRID_METRES - 4 * POST_FOOT_RADIUS_METRES;
/** How high the doorway is, from the deck to the underside of the lintel, in metres. */
export const DOORWAY_HEIGHT_METRES = EDGE_PIECE_HEIGHT_METRES - 2 * LINTEL_RADIUS_METRES;
/** How far the lintel reaches past the outside of each post, in metres. */
export const LINTEL_OVERHANG_METRES = 0.08;
/** How far each door post leans from upright, in radians, so the frame looks set up by hand. */
export const LEFT_POST_LEAN_RADIANS = 0.018;
export const RIGHT_POST_LEAN_RADIANS = -0.012;
/** How many flat sides a door post or lintel has round its length. */
export const DOOR_LOG_SIDES = 10;

/**
 * A debarked log for a door frame, standing along y with its middle at the origin.
 * Its sides are coloured as stripped wood and its two ends as the paler cut wood, so it is drawn with vertex colours.
 */
export function doorLogGeometry(topRadius: number, footRadius: number, length: number): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(topRadius, footRadius, length, DOOR_LOG_SIDES);
  const index = geometry.getIndex();
  const colours = new Float32Array(geometry.getAttribute("position").count * 3);
  const side = new THREE.Color(DEBARKED_LOG_COLOUR);
  const cut = new THREE.Color(DEBARKED_LOG_CUT_COLOUR);
  // A cylinder has three groups: the sides, then the top end, then the foot end.
  geometry.groups.forEach((part, partIndex) => {
    const colour = partIndex === 0 ? side : cut;
    for (let i = part.start; i < part.start + part.count; i++) colour.toArray(colours, (index?.getX(i) ?? i) * 3);
  });
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  geometry.clearGroups();
  return geometry;
}
