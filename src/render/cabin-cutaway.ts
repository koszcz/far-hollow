// What hides while the player is inside a cabin, so the player and the room stay in view.
// - Inside means under a cabin roof or a roof frame still waiting for its roof, or standing in a cabin's doorway, just outside its door frame.
// - The cabin's roof hides as one unit: every roof section joined to the one over the player.
// - Each outer side of the cabin whose outside faces the camera fades as one unit: every wall, door frame, window,
//   door, and set of shutters on it. The sides facing away stay solid, so the room shows behind the player.
// - Anywhere, a piece also fades while it stands between the camera and the player, as it does outside a cabin.
import { BUILD_GRID_METRES, isOnGridSquare, snapToGridSquare } from "../sim/build-grid";
import { edgeMiddle, edgePieceOn, squaresBeside } from "../sim/edge-pieces";
import type { Entity, EntityStore, Vec3 } from "../sim/entities";
import { subtractGroundPoints, type GroundPoint } from "../sim/ground-point";
import { runsAlongX, type QuarterTurns } from "../sim/quarter-turns";
import { roofAbove } from "../sim/roofs";
import { SIDES } from "../sim/structure-kind";
import { EDGE_PIECE_HEIGHT_METRES } from "./log-courses";

/** Where the camera looks at the player from, to fade out walls in the way. The player's middle is used, not their feet. */
const PLAYER_MIDDLE_METRES = 0.9;
/** A wall fades when the line from the camera to the player passes this close beyond its ends or over its top, in metres. */
const FADE_MARGIN_METRES = 0.3;
/** A player this close to the middle of a cabin's door frame, in metres, stands in its doorway and counts as inside. */
const DOORWAY_REACH_METRES = 0.6;

export interface CabinCutaway {
  /** The cabin roof sections and roof frames that hide. A cabin with only its frames up counts. Empty outside a cabin. */
  readonly roof: readonly Entity[];
  /** Whether a finished piece on the edge with this middle, facing `turns`, fades: a wall, door frame, window, door, or shutters. */
  fades(middle: Vec3, turns: QuarterTurns): boolean;
}

/** Nothing hides and nothing fades, as when there is no player to keep in view. */
export const NO_CUTAWAY: CabinCutaway = { roof: [], fades: () => false };

/** What hides and fades for a camera at `camera` looking at the player drawn at `player`. */
export function cabinCutaway(entities: EntityStore, camera: Vec3, player: Vec3): CabinCutaway {
  const roof = cabinAround(entities, player);
  const squares = roof.flatMap((section) => (section.position === undefined ? [] : [section.position]));
  const inCabin = (square: GroundPoint) => squares.some((middle) => isOnGridSquare(middle, square));
  /** Whether the edge is on the cabin's outline, with its outside towards the camera. */
  const facesCamera = (middle: Vec3, turns: QuarterTurns): boolean => {
    const [first, beyond] = squaresBeside(middle, turns);
    const firstIn = inCabin(first);
    if (firstIn === inCabin(beyond)) return false;
    const outward = firstIn ? subtractGroundPoints(beyond, first) : subtractGroundPoints(first, beyond);
    return outward.x * (camera.x - middle.x) + outward.z * (camera.z - middle.z) > 0;
  };
  return {
    roof,
    fades: (middle, turns) => facesCamera(middle, turns) || isBetweenCameraAndPlayer(middle, turns, camera, player),
  };
}

/** The roof of the cabin the player is in, or empty if they are not in one. A player in a cabin's doorway is in it. */
function cabinAround(entities: EntityStore, player: Vec3): Entity[] {
  const overhead = roofAbove(entities, player);
  if (overhead.length > 0) return overhead;
  const square = snapToGridSquare(player);
  for (const side of SIDES) {
    if (edgePieceOn(entities, square, side) !== "doorFrame") continue;
    const doorway = edgeMiddle(square, side);
    if (Math.hypot(player.x - doorway.x, player.z - doorway.z) > DOORWAY_REACH_METRES) continue;
    const cabin = roofAbove(entities, squaresBeside(doorway, side)[1]);
    if (cabin.length > 0) return cabin;
  }
  return [];
}

/**
 * Whether a wall or door frame stands in the way of the camera's view of the player.
 * `middle` is the middle of the piece's edge at deck height, and `turns` the way it faces.
 * It is in the way when the line from the camera to the player's middle crosses the piece, or passes just beyond its ends or over its top.
 */
export function isBetweenCameraAndPlayer(middle: Vec3, turns: QuarterTurns, camera: Vec3, player: Vec3): boolean {
  const alongX = runsAlongX(turns);
  const across = (spot: Vec3) => (alongX ? spot.z - middle.z : spot.x - middle.x);
  const along = (spot: Vec3) => (alongX ? spot.x - middle.x : spot.z - middle.z);
  const target = { x: player.x, y: player.y + PLAYER_MIDDLE_METRES, z: player.z };
  const cameraSide = across(camera);
  const playerSide = across(target);
  // The camera and the player must be on opposite sides of the line the piece stands on.
  if (cameraSide === 0 || cameraSide * playerSide >= 0) return false;
  const share = cameraSide / (cameraSide - playerSide);
  const alongAtCrossing = along(camera) + (along(target) - along(camera)) * share;
  const heightAtCrossing = camera.y + (target.y - camera.y) * share - middle.y;
  return Math.abs(alongAtCrossing) <= BUILD_GRID_METRES / 2 + FADE_MARGIN_METRES && heightAtCrossing <= EDGE_PIECE_HEIGHT_METRES + FADE_MARGIN_METRES;
}
