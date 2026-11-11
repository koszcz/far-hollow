// The felled tree's fall, part of the code-built "chop-animation" in asset-manifest.json. The owner approved the asset.
// The player's swing is in player-mesh.ts. forest-meshes.ts starts a fall when a tree is felled.
import * as THREE from "three";

/** How long a felled tree takes to fall, land, and settle, in seconds. */
export const FALL_SECONDS = 1.6;
/** How long the tree creaks over a little and hangs there before it topples, in seconds. */
const CREAK_SECONDS = 0.3;
/** How far the tree leans while it creaks, in radians. */
const CREAK_RADIANS = 0.05;
/** When the tree hits the ground, in seconds since the fall began. After that it bounces once and settles. */
export const FALL_LANDS_SECONDS = 1.25;
/** How far the top of the tree bounces back up off the ground, in radians. */
const BOUNCE_RADIANS = 0.08;
/** Share of the settling time taken by the first bounce. A small second bounce takes the rest. */
const FIRST_BOUNCE_SHARE = 0.55;
/** How high the second bounce is, as a share of the first. */
const SECOND_BOUNCE_SHARE = 0.2;

/**
 * Tips a felled tree about `axis` for the time since its fall began, and writes the turn to `out`.
 * Returns true once the tree lies still on the ground.
 */
export function tiltForFall(axis: THREE.Vector3, secondsSinceStart: number, out: THREE.Quaternion): boolean {
  out.setFromAxisAngle(axis, fallAngle(Math.max(0, secondsSinceStart)));
  return secondsSinceStart >= FALL_SECONDS;
}

/** How far the tree has tipped from upright, in radians. A quarter turn lies flat on the ground. */
function fallAngle(seconds: number): number {
  const flat = Math.PI / 2;
  if (seconds < CREAK_SECONDS) {
    // Creak over a little, then hang for a moment.
    const creak = seconds / CREAK_SECONDS;
    return CREAK_RADIANS * creak * creak * (3 - 2 * creak);
  }
  if (seconds < FALL_LANDS_SECONDS) {
    // Topple from rest, speeding up all the way down, like a real tree.
    const topple = (seconds - CREAK_SECONDS) / (FALL_LANDS_SECONDS - CREAK_SECONDS);
    return CREAK_RADIANS + (flat - CREAK_RADIANS) * topple ** 2.4;
  }
  // Bounce once off the ground, then a little again, then lie still.
  const settle = Math.min(1, (seconds - FALL_LANDS_SECONDS) / (FALL_SECONDS - FALL_LANDS_SECONDS));
  if (settle < FIRST_BOUNCE_SHARE) return flat - BOUNCE_RADIANS * Math.sin((settle / FIRST_BOUNCE_SHARE) * Math.PI);
  const second = (settle - FIRST_BOUNCE_SHARE) / (1 - FIRST_BOUNCE_SHARE);
  return flat - BOUNCE_RADIANS * SECOND_BOUNCE_SHARE * Math.sin(second * Math.PI);
}
