// The code-built placeholder shape approved in asset-manifest.json as "logs".
import * as THREE from "three";

export const LOG_COLOUR = 0x7a5532;
export const LOG_LENGTH_METRES = 1;
export const LOG_RADIUS_METRES = 0.18;

/** A log lying along the z axis, centred on the origin. */
export function createLogGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(LOG_RADIUS_METRES, LOG_RADIUS_METRES, LOG_LENGTH_METRES, 7);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}
