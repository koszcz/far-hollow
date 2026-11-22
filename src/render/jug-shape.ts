// How a jug looks, the approved "jug" asset in asset-manifest.json. Built in code. Added by clay ticket 02.
// pile-meshes.ts stands unfired jugs and jugs upright in a pile, spread like other things in a pile. Clay ticket 03 added the
// fired look, and jug-on-fire-meshes.ts, which sits a jug on a campfire or fireplace.
// A jug is about 24 cm tall and faceted, like the stones and firewood around it: a small foot ring, an egg-shaped belly, a
// paler band of slip round the shoulder, a narrow neck that flares to a lip, a dark open mouth, and a flat clay strap handle
// from the shoulder to just under the lip. The unfired jug is dull, pale grey-brown clay, with no shine. The fired jug is warm
// orange-brown terracotta, with a faint sheen.
// The geometry carries vertex colours that shade the material's colour: the band is paler and the mouth is dark. So one
// material colour, which jug-on-fire-meshes.ts turns from unfired to fired, colours the whole jug.
// The pivot is the middle of the jug's base. Sizes are in metres.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Dried, unfired clay: paler than wet clay, with no shine. */
export const UNFIRED_JUG_COLOUR = 0xa88b72;
/** Fired clay: warm orange-brown terracotta. */
export const FIRED_JUG_COLOUR = 0xb0603c;
/** How rough each look is. Unfired clay is chalky. Fired clay has a faint sheen. */
export const UNFIRED_JUG_ROUGHNESS = 0.95;
export const FIRED_JUG_ROUGHNESS = 0.75;
/** The material options every jug uses: faceted, and shaded by the geometry's vertex colours. */
export const JUG_MATERIAL_OPTIONS = { flatShading: true, vertexColors: true } as const;
/** Sides of the jug. Few sides keep it faceted, like the stones and firewood. */
const JUG_SIDES = 10;

/** How each part shades the material's colour. Above 1 is paler. */
const BODY_SHADE = 1;
const BAND_SHADE = 1.18;
const MOUTH_SHADE = 0.28;

type Outline = readonly (readonly [number, number])[];

/** From the middle of the base, out over the foot ring and up the belly to the shoulder band, as (radius, height) pairs. */
const BELLY: Outline = [
  [0, 0],
  [0.046, 0],
  [0.05, 0.005],
  [0.047, 0.012],
  [0.062, 0.02],
  [0.08, 0.042],
  [0.092, 0.075],
  [0.095, 0.103],
  [0.089, 0.132],
  [0.076, 0.155],
];
/** The paler band of slip round the shoulder. */
const BAND: Outline = [
  [0.076, 0.155],
  [0.06, 0.172],
];
/** From the band up the neck, out to the lip and over its top edge. */
const NECK: Outline = [
  [0.06, 0.172],
  [0.042, 0.185],
  [0.033, 0.2],
  [0.032, 0.214],
  [0.039, 0.229],
  [0.045, 0.238],
  [0.035, 0.241],
];
/** Down inside the mouth to a hidden floor. It carries on from the lip, so its faces look up and out of the mouth. */
const MOUTH: Outline = [
  [0.035, 0.241],
  [0.028, 0.226],
  [0.026, 0.205],
  [0, 0.195],
];

/** Turns one outline round the upright axis, with every vertex shaded by `shade`. Not indexed, so the parts merge. */
function turned(outline: Outline, shade: number): THREE.BufferGeometry {
  const lathe = new THREE.LatheGeometry(
    outline.map(([radius, height]) => new THREE.Vector2(radius, height)),
    JUG_SIDES,
  );
  const geometry = lathe.toNonIndexed();
  lathe.dispose();
  return shaded(geometry, shade);
}

/** Gives every vertex of `geometry` the same shade, as a vertex colour. */
function shaded(geometry: THREE.BufferGeometry, shade: number): THREE.BufferGeometry {
  const count = geometry.getAttribute("position").count;
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(new Array<number>(count * 3).fill(shade), 3));
  return geometry;
}

/** The strap handle's path, on the jug's +x side: from inside the shoulder, out and up in a loop, and in under the lip. */
const HANDLE_PATH = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0.068, 0.148, 0),
  new THREE.Vector3(0.1, 0.163, 0),
  new THREE.Vector3(0.114, 0.195, 0),
  new THREE.Vector3(0.098, 0.224, 0),
  new THREE.Vector3(0.062, 0.229, 0),
  new THREE.Vector3(0.03, 0.222, 0),
]);
/** The strap is this wide across the jug, and this thick from the inside of the loop to the outside. */
const HANDLE_WIDTH = 0.024;
const HANDLE_THICKNESS = 0.008;

/** A flat clay strap, wide across the jug and thin through the loop. */
function createHandleGeometry(): THREE.BufferGeometry {
  // The path lies flat in the x-y plane, so the shape's x follows the loop's bend and its y runs across the jug.
  const strap = new THREE.Shape();
  strap.moveTo(-HANDLE_THICKNESS / 2, -HANDLE_WIDTH / 2);
  strap.lineTo(HANDLE_THICKNESS / 2, -HANDLE_WIDTH / 2);
  strap.lineTo(HANDLE_THICKNESS / 2, HANDLE_WIDTH / 2);
  strap.lineTo(-HANDLE_THICKNESS / 2, HANDLE_WIDTH / 2);
  strap.closePath();
  const geometry = new THREE.ExtrudeGeometry(strap, { steps: 8, extrudePath: HANDLE_PATH, bevelEnabled: false });
  geometry.clearGroups();
  return shaded(geometry, BODY_SHADE);
}

/** The jug's body, mouth, and handle, standing on y = 0, with vertex colours. The same every time. */
export function createJugGeometry(): THREE.BufferGeometry {
  const parts = [turned(BELLY, BODY_SHADE), turned(BAND, BAND_SHADE), turned(NECK, BODY_SHADE), turned(MOUTH, MOUTH_SHADE), createHandleGeometry()];
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
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
  return [{ geometry: track(createJugGeometry()), material: material(UNFIRED_JUG_COLOUR, { ...JUG_MATERIAL_OPTIONS, roughness: UNFIRED_JUG_ROUGHNESS }) }];
}

/**
 * One empty jug, standing upright, as parts to lie in a pile.
 * `material` makes a material from a colour, and `track` hands the geometry to the caller to dispose.
 */
export function jugPileParts(material: MakeMaterial, track: Track): readonly { geometry: THREE.BufferGeometry; material: THREE.Material }[] {
  return [{ geometry: track(createJugGeometry()), material: material(FIRED_JUG_COLOUR, { ...JUG_MATERIAL_OPTIONS, roughness: FIRED_JUG_ROUGHNESS }) }];
}
