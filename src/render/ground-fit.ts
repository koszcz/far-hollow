// Lays a low, flat thing, such as a bedroll or a campfire's stone ring, on sloping ground.
// A thing placed flat at the ground height of its middle sinks into the ground on its uphill side.
// This tilts it to the slope under its footprint and lifts it just enough that no corner or middle is buried.
import * as THREE from "three";
import type { Vec3 } from "../sim/entities";

/** A thing more than this high above the ground stands on something else, such as a foundation deck, and lies flat. */
const ON_DECK_METRES = 0.05;

const UP = new THREE.Vector3(0, 1, 0);

/** How to lay a thing on the ground: the height of its pivot, and the turn that tilts it from upright to the slope. */
export interface GroundFit {
  readonly y: number;
  /** In world space. Apply it after the thing's own turn about the vertical. */
  readonly tilt: THREE.Quaternion;
}

/**
 * Fits a rectangular footprint, `halfX` by `halfZ` metres from its middle and turned `yaw` radians, to the ground at `spot`.
 * `groundAt` gives the height of the ground. A spot above the ground, such as on a foundation deck, stays flat at its own height.
 */
export function fitToGround(groundAt: (x: number, z: number) => number, spot: Readonly<Vec3>, halfX: number, halfZ: number, yaw = 0): GroundFit {
  if (spot.y - groundAt(spot.x, spot.z) > ON_DECK_METRES) return { y: spot.y, tilt: new THREE.Quaternion() };
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  /** A point of the footprint, `u` along its own x and `v` along its own z, on the ground in the world. */
  const onGround = (u: number, v: number) => {
    const x = spot.x + u * cos + v * sin;
    const z = spot.z - u * sin + v * cos;
    return new THREE.Vector3(x, groundAt(x, z), z);
  };
  const corners = [onGround(-halfX, -halfZ), onGround(halfX, -halfZ), onGround(halfX, halfZ), onGround(-halfX, halfZ)];
  const [backLeft, backRight, frontRight, frontLeft] = corners as [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3];
  // The slope across the footprint and along it, each averaged over both of its edges.
  const across = backRight.clone().add(frontRight).sub(backLeft).sub(frontLeft);
  const along = frontLeft.clone().add(frontRight).sub(backLeft).sub(backRight);
  const normal = along.cross(across).normalize();
  const middle = corners.reduce((sum, corner) => sum.add(corner), new THREE.Vector3()).divideScalar(corners.length);
  /** How far the tilted plane through the middle lies below the ground at a point. */
  const buried = (point: THREE.Vector3) => point.y - (middle.y - (normal.x * (point.x - middle.x) + normal.z * (point.z - middle.z)) / normal.y);
  const lift = Math.max(0, buried(onGround(0, 0)), ...corners.map(buried));
  return { y: middle.y + lift, tilt: new THREE.Quaternion().setFromUnitVectors(UP, normal) };
}
