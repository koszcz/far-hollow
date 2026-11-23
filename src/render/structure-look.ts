// What every structure's meshes share: the colours and see-through look of a blueprint, the red of a blueprint that is not
// allowed where the player is placing it, how each part fades in and is set down during construction, and how a click
// finds a blueprint or a finished structure. It also holds the interface every building piece's meshes offer.
import * as THREE from "three";
import type { Entity, Vec3 } from "../sim/entities";
import type { QuarterTurns } from "../sim/quarter-turns";
import type { OutlinePart } from "./hover-outline";

/** The pale blue of a blueprint's parts that are not built yet. */
export const BLUEPRINT_COLOUR = 0xbfe3ff;
/** How see-through the parts of a blueprint not yet built are, from 0 (invisible) to 1 (solid). */
export const BLUEPRINT_OPACITY = 0.35;
/** A part whose material the blueprint already has is this solid, so it stands out from the parts still needed. */
export const DELIVERED_OPACITY = 0.7;
/** A blueprint the player is placing shows in this red where its placement rule refuses the spot. */
export const NOT_ALLOWED_COLOUR = 0xe0614f;

/** What a click on a blueprint landed on. */
export type BlueprintHit = { kind: "blueprint"; entity: Entity };

/** Where the blueprint under the mouse goes while the player places one, which way it faces, and whether it is allowed there. */
export interface PlacingSpot {
  readonly spot: Vec3;
  readonly turns: QuarterTurns;
  readonly allowed: boolean;
}

/**
 * The meshes of one kind of building piece that the player builds from a blueprint, such as a floor or a door.
 * `Frame` is what one frame of drawing needs to know, if anything.
 */
export interface BuildingPieceMeshes<Frame = void> {
  readonly group: THREE.Group;
  /** Brings every piece and blueprint of this kind up to date with game state. */
  update(frame: Frame): void;
  /** The blueprint of this kind a ray from the camera hits first, and how far away. */
  pick(raycaster: THREE.Raycaster): { hit: BlueprintHit; distance: number } | undefined;
  /** The finished piece of this kind a ray hits first, and how far away. */
  pickFinished(raycaster: THREE.Raycaster): { entity: Entity; distance: number } | undefined;
  /** The parts of a piece or blueprint, placed in the world. Empty once it is gone. */
  outlineOf(hit: { readonly entity: Entity }): OutlinePart[];
  /** Shows a blueprint under the mouse, red where it is not allowed. Undefined hides it. */
  showPlacingBlueprint(placing: PlacingSpot | undefined): void;
  dispose(): void;
}

const hits: THREE.Intersection[] = [];

/** The nearest blueprint a ray hits, and how far away it is. Each of `pickers` holds its entity in `userData.entity`. */
export function pickBlueprint(raycaster: THREE.Raycaster, pickers: readonly THREE.Object3D[]): { hit: BlueprintHit; distance: number } | undefined {
  hits.length = 0;
  raycaster.intersectObjects([...pickers], false, hits);
  hits.sort((a, b) => a.distance - b.distance);
  for (const hit of hits) {
    const entity = hit.object.userData.entity as Entity | undefined;
    if (entity?.blueprint !== undefined) return { hit: { kind: "blueprint", entity }, distance: hit.distance };
  }
  return undefined;
}

/**
 * The nearest finished structure a ray hits, and how far away it is. Each of `pickers` holds its entity in `userData.entity`.
 * Blueprints are skipped. A picker off the default layer, such as a hidden roof drawn only into shadows, is never hit.
 */
export function pickFinished(raycaster: THREE.Raycaster, pickers: readonly THREE.Object3D[]): { entity: Entity; distance: number } | undefined {
  hits.length = 0;
  raycaster.intersectObjects([...pickers], false, hits);
  hits.sort((a, b) => a.distance - b.distance);
  for (const hit of hits) {
    const entity = hit.object.userData.entity as Entity | undefined;
    if (entity !== undefined && entity.blueprint === undefined) return { entity, distance: hit.distance };
  }
  return undefined;
}

/** A finished wall, door frame, window, door, or shutters between the camera and the player is this solid, from 0 (invisible) to 1 (solid). */
export const FADED_OPACITY = 0.2;

/**
 * A see-through material for a finished piece faded out between the camera and the player, of `color`, from 0 (invisible)
 * to 1 (solid) `opacity`. It still casts its shadow, so the room behind a faded wall stays in shade.
 */
export function fadedOut(color: number, opacity: number): THREE.MeshStandardMaterial {
  const material = seeThrough(color, opacity);
  material.userData.castsShadow = true;
  return material;
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
