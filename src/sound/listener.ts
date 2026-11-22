// Where the game hears from, and every rule about how loud a point sound is and which side it comes from. See docs/adr/0009.
import { groundDistance, headingToward, type GroundPoint } from "../sim/ground-point";
import { clampShare } from "../sim/share";

/** Point sounds fade to silence at this distance from the player, in metres. */
export const SILENT_AT_METRES = 30;

/**
 * Where the game hears from: the player's spot, facing the way the camera looks.
 * `facing` is a heading in radians about the vertical axis, from +z toward +x.
 */
export interface Listener {
  readonly spot: GroundPoint;
  readonly facing: number;
}

/** Where the camera is and the point it looks at, seen from above. Height is ignored. */
export interface CameraOnGround {
  readonly eye: GroundPoint;
  readonly focus: GroundPoint;
}

/** A listener at the player's spot, facing from the camera's eye toward the point it looks at. */
export function listenerFrom(player: GroundPoint, camera: CameraOnGround): Listener {
  return { spot: { x: player.x, z: player.z }, facing: headingToward(camera.eye, camera.focus) };
}

/**
 * How loud a point sound at `source` is for the listener, from 1 at the player's spot to 0 at SILENT_AT_METRES and beyond.
 * It falls fast close in and slowly far out, as sound does outdoors.
 */
export function distanceFade(listener: Listener, source: GroundPoint): number {
  const left = clampShare(1 - groundDistance(listener.spot, source) / SILENT_AT_METRES);
  return left * left;
}

/**
 * Which side a point sound at `source` comes from, as the camera sees it: -1 fully left, 0 in the middle, 1 fully right.
 * A sound straight ahead, straight behind, or at the player's spot is in the middle.
 */
export function panToward(listener: Listener, source: GroundPoint): number {
  if (groundDistance(listener.spot, source) === 0) return 0;
  // With the camera looking along +z, the screen's right is -x, which is a quarter turn the negative way.
  return -Math.sin(headingToward(listener.spot, source) - listener.facing);
}
