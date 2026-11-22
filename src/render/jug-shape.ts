// How a jug looks, the draft "jug" asset in asset-manifest.json. Built in code. Added by clay ticket 02.
// pile-meshes.ts stands unfired jugs upright in a pile, spread like other things in a pile. Clay ticket 03 adds the fired
// look and the jug sitting on a fire.
// A jug is about 24 cm tall: a round belly, a narrow neck that flares to a lip, and a loop handle from the shoulder to the
// neck. The unfired jug is dull, pale grey-brown clay, with no shine.
// The pivot is the middle of the jug's base. Sizes are in metres.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Dried, unfired clay: paler than wet clay, with no shine. */
const UNFIRED_COLOUR = 0xa88b72;
/** Sides of the jug. More sides make it rounder and cost more. */
const JUG_SIDES = 14;

/** The jug's outline from the base up, as (radius, height) pairs. The lathe turns it round the upright axis. */
const OUTLINE: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.06, 0],
  [0.085, 0.03],
  [0.095, 0.08],
  [0.088, 0.13],
  [0.06, 0.17],
  [0.035, 0.19],
  [0.032, 0.215],
  [0.042, 0.235],
  [0.038, 0.24],
  [0.028, 0.232],
];

/** The jug's body and handle, standing on y = 0. The same every time. */
export function createJugGeometry(): THREE.BufferGeometry {
  const body = new THREE.LatheGeometry(
    OUTLINE.map(([radius, height]) => new THREE.Vector2(radius, height)),
    JUG_SIDES,
  );
  // Half a ring on the jug's side, from the shoulder up to the neck.
  const handle = new THREE.TorusGeometry(0.045, 0.009, 6, 10, Math.PI).rotateZ(-Math.PI / 2).translate(0.045, 0.17, 0);
  const merged = mergeGeometries([body, handle]);
  body.dispose();
  handle.dispose();
  return merged;
}

/** Makes a material from a colour and options. The caller disposes it. */
type MakeMaterial = (colour: number, options?: THREE.MeshStandardMaterialParameters) => THREE.Material;
/** Hands a geometry to the caller to dispose, and returns it. */
type Track = <T extends { dispose(): void }>(resource: T) => T;

/**
 * One unfired jug, standing upright, as parts to lie in a pile.
 * `material` makes a material from a colour, and `track` hands the geometry to the caller to dispose.
 */
export function unfiredJugPileParts(material: MakeMaterial, track: Track): readonly { geometry: THREE.BufferGeometry; material: THREE.Material }[] {
  return [{ geometry: track(createJugGeometry()), material: material(UNFIRED_COLOUR, { flatShading: false, roughness: 0.95 }) }];
}
