// How one clay lies in a pile, part of the draft "clay" asset in asset-manifest.json. Built in code.
// Added by clay ticket 01. pile-meshes.ts lays clay out like the other things in a pile, and the gather-stone motion
// shows this lump in the player's hands while they dig clay.
// One clay is a soft, rounded lump of wet river clay, about 16 cm across: a smooth, squat ball, cut flat where it sits.
// It is made the same way as a stone in stone-shape.ts, with a warm grey-brown and fewer lumps.
// The pivot is the middle of the lump's underside. Sizes are in metres.
import type * as THREE from "three";
import { createLumpyStoneGeometry } from "./stone-shape";

/** Wet river clay: a warm grey-brown. */
const CLAY_COLOUR = 0x8f7260;

/** One clay lump, resting on y = 0, with a colour on each face. Draw it with a white material that uses vertex colours. The same every time. */
export function createClayGeometry(): THREE.BufferGeometry {
  return createLumpyStoneGeometry({ seed: 53, size: [0.16, 0.1, 0.17], lumpiness: 0.1, colour: CLAY_COLOUR });
}

/** Makes a material from a colour and options. The caller disposes it. */
type MakeMaterial = (colour: number, options?: THREE.MeshStandardMaterialParameters) => THREE.Material;
/** Hands a geometry to the caller to dispose, and returns it. */
type Track = <T extends { dispose(): void }>(resource: T) => T;

/** One clay, as parts to lie in a pile. `material` makes a material from a colour, and `track` hands the geometry to the caller to dispose. */
export function clayPileParts(material: MakeMaterial, track: Track): readonly { geometry: THREE.BufferGeometry; material: THREE.Material }[] {
  return [{ geometry: track(createClayGeometry()), material: material(0xffffff, { vertexColors: true, flatShading: false, roughness: 0.7 }) }];
}
