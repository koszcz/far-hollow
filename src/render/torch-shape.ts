// The code-built "torch" (draft) in asset-manifest.json: a stick about 55 cm long with a head of bark wrapped round its top
// end and tied with two dark bands. The tip of the head is charred. Added by torch ticket 01.
// Upright, as the player holds it, its butt is at the origin and its head points up. In a pile it lies on its side.
// A lit torch burns with the approved "fire-effect" at a small size, standing on the head. See createTorchFlame.
import * as THREE from "three";
import type { Fire, FireMaker } from "./fire-effect";

/** The same colours as a stick on the forest floor and as bark. */
const STICK_COLOUR = 0x8a5a32;
const BARK_COLOUR = 0x7a5232;
const BAND_COLOUR = 0x3f2a1a;
const CHAR_COLOUR = 0x2a201a;

/** The stick's length and radius, in metres. */
const STICK_LENGTH_METRES = 0.55;
const STICK_RADIUS_METRES = 0.014;
/** The bark head: how long it is, how wide, and where it starts up the stick, in metres. */
const HEAD_LENGTH_METRES = 0.13;
const HEAD_RADIUS_METRES = 0.032;
const HEAD_FROM_METRES = STICK_LENGTH_METRES - HEAD_LENGTH_METRES;
/** How tall the charred tip of the head is, in metres. */
const CHAR_METRES = 0.025;

/** Where the flame stands on an upright torch: the top of its head, in metres above the butt. */
export const TORCH_FLAME_HEIGHT_METRES = STICK_LENGTH_METRES;
/** The flame is the campfire's fire at this share of its size. */
const FLAME_SCALE = 0.17;
/** How much a pile lifts each torch, so it lies on the ground on its head, in metres. */
const LYING_LIFT_METRES = HEAD_RADIUS_METRES;

export interface TorchShape {
  /** The torch standing upright, its butt at the origin. */
  readonly parts: readonly { readonly geometry: THREE.BufferGeometry; readonly material: THREE.Material }[];
  /** The same torch lying on its side along x on the ground, centred on the origin, for a pile. */
  readonly lyingParts: readonly { readonly geometry: THREE.BufferGeometry; readonly material: THREE.Material }[];
  dispose(): void;
}

/** A round part standing on the torch's line from `from` to `from + length`, wider at the top by `flare`. */
function roundPart(radius: number, length: number, from: number, flare = 1, sides = 7): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(radius * flare, radius, length, sides).translate(0, from + length / 2, 0);
}

export function createTorchShape(): TorchShape {
  const material = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true });
  const stick = material(STICK_COLOUR);
  const bark = material(BARK_COLOUR);
  const band = material(BAND_COLOUR);
  const char = material(CHAR_COLOUR);
  const parts = [
    { geometry: roundPart(STICK_RADIUS_METRES, HEAD_FROM_METRES + 0.01, 0, 1.1, 6), material: stick },
    { geometry: roundPart(HEAD_RADIUS_METRES * 0.85, HEAD_LENGTH_METRES - CHAR_METRES, HEAD_FROM_METRES, 1.18), material: bark },
    {
      geometry: roundPart(HEAD_RADIUS_METRES * 0.95, CHAR_METRES, STICK_LENGTH_METRES - CHAR_METRES, 0.8),
      material: char,
    },
    { geometry: roundPart(HEAD_RADIUS_METRES * 0.9, 0.012, HEAD_FROM_METRES + 0.02, 1.02), material: band },
    { geometry: roundPart(HEAD_RADIUS_METRES, 0.012, HEAD_FROM_METRES + 0.07, 1.02), material: band },
  ];
  const lyingParts = parts.map(({ geometry, material: partMaterial }) => ({
    geometry: geometry
      .clone()
      .translate(0, -STICK_LENGTH_METRES / 2, 0)
      .rotateZ(-Math.PI / 2)
      .translate(0, LYING_LIFT_METRES, 0),
    material: partMaterial,
  }));
  return {
    parts,
    lyingParts,
    dispose() {
      for (const part of [...parts, ...lyingParts]) part.geometry.dispose();
      for (const made of [stick, bark, band, char]) made.dispose();
    },
  };
}

/** A small fire from `fireMaker`, standing on the head of an upright torch. Add its group to the torch's group. */
export function createTorchFlame(fireMaker: FireMaker): Fire {
  const fire = fireMaker.make();
  fire.group.position.y = TORCH_FLAME_HEIGHT_METRES - CHAR_METRES;
  fire.group.scale.setScalar(FLAME_SCALE);
  return fire;
}
