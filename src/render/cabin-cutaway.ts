// What hides and fades in each wall mode (src/wall-mode.ts), so the player can see into cabins.
// - Walls up: no roof hides, and no cabin side fades.
// - Cutaway: every cabin roof section and roof frame hides. Each outer side of a cabin whose outside faces the camera fades
//   as one unit: every wall, door frame, window, door, and set of shutters on it. The sides facing away stay solid.
// - Walls down: every cabin roof section and roof frame hides, and every outer side of every cabin fades.
// - In every wall mode, a piece also fades while it stands between the camera and the player.
// Where the player stands changes nothing else. A cabin with only its roof frames up counts as a cabin.
import { BUILD_GRID_METRES, isOnGridSquare } from "../sim/build-grid";
import { squaresBeside } from "../sim/edge-pieces";
import { type Entity, type EntityStore, type Vec3 } from "../sim/entities";
import { cabinRoofEntities, roofFrameEntities } from "../sim/entity-queries";
import { subtractGroundPoints, type GroundPoint } from "../sim/ground-point";
import { runsAlongX, type QuarterTurns } from "../sim/quarter-turns";
import { EDGE_PIECE_HEIGHT_METRES } from "./log-courses";
import { fadesCabinSide, hidesRoofs, type WallMode } from "../wall-mode";

/** Where the camera looks at the player from, to fade out walls in the way. The player's middle is used, not their feet. */
const PLAYER_MIDDLE_METRES = 0.9;
/** A wall fades when the line from the camera to the player passes this close beyond its ends or over its top, in metres. */
const FADE_MARGIN_METRES = 0.3;

export interface CabinCutaway {
  /** The cabin roof sections and roof frames that hide. Empty in walls up. */
  readonly roof: readonly Entity[];
  /** Whether a finished piece on the edge with this middle, facing `turns`, fades: a wall, door frame, window, door, or shutters. */
  fades(middle: Vec3, turns: QuarterTurns): boolean;
}

/** Nothing hides and nothing fades, as when there is no player to keep in view. */
export const NO_CUTAWAY: CabinCutaway = { roof: [], fades: () => false };

/** What hides and fades in wall mode `mode`, for a camera at `camera` looking at the player drawn at `player`. */
export function cabinCutaway(entities: EntityStore, mode: WallMode, camera: Vec3, player: Vec3): CabinCutaway {
  const cover = [...cabinRoofEntities(entities), ...roofFrameEntities(entities)];
  const squares = cover.map((section) => section.position);
  const inCabin = (square: GroundPoint) => squares.some((middle) => isOnGridSquare(middle, square));
  /** Whether a cabin side on the edge fades: an edge on a cabin's outline, faded as the wall mode says for the way its outside faces. */
  const sideFades = (middle: Vec3, turns: QuarterTurns): boolean => {
    // When not even a side facing the camera fades, as in walls up, no side does, so skip the search.
    if (!fadesCabinSide(mode, true)) return false;
    const [first, beyond] = squaresBeside(middle, turns);
    const firstIn = inCabin(first);
    if (firstIn === inCabin(beyond)) return false;
    const outward = firstIn ? subtractGroundPoints(beyond, first) : subtractGroundPoints(first, beyond);
    return fadesCabinSide(mode, outward.x * (camera.x - middle.x) + outward.z * (camera.z - middle.z) > 0);
  };
  return {
    roof: hidesRoofs(mode) ? cover : [],
    fades: (middle, turns) => sideFades(middle, turns) || isBetweenCameraAndPlayer(middle, turns, camera, player),
  };
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
