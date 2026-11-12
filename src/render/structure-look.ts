// What every structure's meshes share: the red of a blueprint that is not allowed where the player is placing it,
// the see-through look of a blueprint, how each part fades in and is set down during construction,
// how a structure turns the way it faces, and how a click finds a finished structure.
import * as THREE from "three";
import type { Entity } from "../sim/entities";

/** A blueprint the player is placing shows in this red where its placement rule refuses the spot. */
export const NOT_ALLOWED_COLOUR = 0xe0614f;

/** How far round a structure facing `turns` quarter turns is drawn, in radians. Quarter turns go clockwise seen from above. */
export function facingRadians(turns: number): number {
  return -turns * (Math.PI / 2);
}

const hits: THREE.Intersection[] = [];

/**
 * The nearest finished structure a ray hits, and how far away it is. Each of `pickers` holds its entity in `userData.entity`.
 * Blueprints are skipped, and so is any picker that `isShown` says is hidden.
 */
export function pickFinished(
  raycaster: THREE.Raycaster,
  pickers: readonly THREE.Object3D[],
  isShown: (picker: THREE.Object3D) => boolean = () => true,
): { entity: Entity; distance: number } | undefined {
  hits.length = 0;
  raycaster.intersectObjects([...pickers], false, hits);
  hits.sort((a, b) => a.distance - b.distance);
  for (const hit of hits) {
    const entity = hit.object.userData.entity as Entity | undefined;
    if (entity !== undefined && entity.blueprint === undefined && isShown(hit.object)) return { entity, distance: hit.distance };
  }
  return undefined;
}

/** A see-through material for a blueprint, of `color`, from 0 (invisible) to 1 (solid) `opacity`. It hides nothing behind it. */
export function seeThrough(color: number, opacity: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, transparent: true, opacity, depthWrite: false });
}

// The build animation. Construction lays one part per stage, such as a stick or a log.
// Every BUILD_*_SHARE below is a share of one stage.
/** A new part fades in this high above its place, in metres, already turned the way it will lie. */
const BUILD_HOVER_METRES = 0.35;
/** It is lowered, easing in and out, to just this high above its place, in metres. */
const BUILD_LOWERED_METRES = 0.06;
/** The new part fades in over this first share of its stage. */
export const BUILD_FADE_SHARE = 0.15;
/** The part is lowered until this share of its stage. */
export const BUILD_LOWERED_SHARE = 0.6;
/** It pauses just above its place until this share. */
export const BUILD_HOLD_SHARE = 0.68;
/** It drops, speeding up, and touches down at this share. It rests in place for the rest of the stage. */
export const BUILD_SET_DOWN_SHARE = 0.8;

/** How solid the part being laid is, from 0 to 1, at `share` of its stage. */
export function buildOpacity(share: number): number {
  return Math.min(1, share / BUILD_FADE_SHARE);
}

/**
 * How high above its place the part being laid is, in metres, at `share` of its stage.
 * It is lowered from where it fades in, holds just above its place, drops, and rests.
 */
export function buildLift(share: number): number {
  if (share < BUILD_LOWERED_SHARE) {
    return BUILD_HOVER_METRES + (BUILD_LOWERED_METRES - BUILD_HOVER_METRES) * easeInOut(share / BUILD_LOWERED_SHARE);
  }
  if (share < BUILD_HOLD_SHARE) return BUILD_LOWERED_METRES;
  if (share >= BUILD_SET_DOWN_SHARE) return 0;
  const dropped = ((share - BUILD_HOLD_SHARE) / (BUILD_SET_DOWN_SHARE - BUILD_HOLD_SHARE)) ** 2;
  return BUILD_LOWERED_METRES * (1 - dropped);
}

/**
 * How solid a delivered part is at `share` of its stage. A delivered part already waits in its place `start` solid,
 * so it stays there and eases to solid by the time a lowered part would touch down.
 */
export function deliveredOpacity(start: number, share: number): number {
  return start + (1 - start) * easeInOut(Math.min(1, Math.max(0, share / BUILD_SET_DOWN_SHARE)));
}

function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}
