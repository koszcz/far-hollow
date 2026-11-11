// The felled tree's fall, part of the code-built draft "chop-animation" in asset-manifest.json.
// The player's swing is in player-mesh.ts. forest-meshes.ts starts a fall when a tree is felled.
import * as THREE from "three";

/** How long a felled tree takes to hit the ground, in seconds. */
export const FALL_SECONDS = 1.6;

/**
 * Tips a felled tree about `axis` for the time since its fall began, and writes the turn to `out`.
 * Returns true once the tree lies on the ground.
 */
export function tiltForFall(axis: THREE.Vector3, secondsSinceStart: number, out: THREE.Quaternion): boolean {
  const t = Math.min(1, secondsSinceStart / FALL_SECONDS);
  // Speeds up as it goes, like a real tree toppling.
  out.setFromAxisAngle(axis, t * t * (Math.PI / 2));
  return t >= 1;
}
