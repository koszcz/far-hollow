// The code-built "torch" (approved) in asset-manifest.json: a stick about 55 cm long that thickens a little towards its top, with a
// chunky, lumpy head of bark wrapped round its top end and tied with two light rope bands. The tip of the head is charred.
// Added by torch ticket 01.
// Upright, as the player holds it or as it stands planted, it is always lit: its butt is at the origin, its head points up, and
// its charred tip glows faintly like embers. In a pile it lies on its side, unlit, and the tip does not glow.
// A lit torch burns with the approved "fire-effect" at a small size, standing on the head. See createTorchFlame.
import * as THREE from "three";
import type { Fire, FireMaker } from "./fire-effect";

/** The same colours as a stick on the forest floor and as bark, with a lighter bark for the lumps of the wrap. */
const STICK_COLOUR = 0x8a5a32;
const BARK_COLOUR = 0x7a5232;
const BARK_LIGHT_COLOUR = 0x8f6238;
const ROPE_COLOUR = 0xb0905e;
const CHAR_COLOUR = 0x2a201a;
/** The ember glow on the charred tip of a lit torch, and how strong it is. */
const EMBER_COLOUR = 0xff5a1a;
const EMBER_STRENGTH = 0.55;

/** The stick's length, in metres, and its radius at the butt and just under the head. */
const STICK_LENGTH_METRES = 0.55;
const STICK_BUTT_RADIUS_METRES = 0.016;
const STICK_TOP_RADIUS_METRES = 0.021;
/** The bark head: how long it is, how wide at its widest, and where it starts up the stick, in metres. */
const HEAD_LENGTH_METRES = 0.15;
const HEAD_RADIUS_METRES = 0.05;
const HEAD_FROM_METRES = STICK_LENGTH_METRES - HEAD_LENGTH_METRES;
/** How tall the charred tip of the head is, in metres. */
const CHAR_METRES = 0.03;

/** Where the flame stands on an upright torch: the top of its head, in metres above the butt. */
export const TORCH_FLAME_HEIGHT_METRES = STICK_LENGTH_METRES;
/** The flame is the campfire's fire at this share of its size. */
const FLAME_SCALE = 0.17;
/** How much a pile lifts each torch, so it lies on the ground on its head, in metres. */
const LYING_LIFT_METRES = HEAD_RADIUS_METRES;

type Part = { readonly geometry: THREE.BufferGeometry; readonly material: THREE.Material };

export interface TorchShape {
  /** The torch standing upright and lit, its butt at the origin. */
  readonly parts: readonly Part[];
  /** The same torch lying on its side along x on the ground, unlit, centred on the origin, for a pile. */
  readonly lyingParts: readonly Part[];
  dispose(): void;
}

/**
 * A round part standing on the torch's line from `from` to `from + length`, with `radius` at its bottom and `radius * flare` at
 * its top. `turn` spins it about the line and `offset` pushes it off the line, both so stacked lumps do not line up.
 */
function roundPart(radius: number, length: number, from: number, flare = 1, sides = 7, turn = 0, offset = 0): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(radius * flare, radius, length, sides)
    .rotateY(turn)
    .translate(offset * Math.cos(turn), from + length / 2, offset * Math.sin(turn));
}

export function createTorchShape(): TorchShape {
  const material = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true });
  const stick = material(STICK_COLOUR);
  const bark = material(BARK_COLOUR);
  const barkLight = material(BARK_LIGHT_COLOUR);
  const rope = material(ROPE_COLOUR);
  const char = material(CHAR_COLOUR);
  const ember = new THREE.MeshStandardMaterial({
    color: CHAR_COLOUR,
    emissive: EMBER_COLOUR,
    emissiveIntensity: EMBER_STRENGTH,
    roughness: 0.95,
    flatShading: true,
  });
  const h = HEAD_FROM_METRES;
  const r = HEAD_RADIUS_METRES;
  // The stick, then a small knot part way up it.
  const wood = [
    {
      geometry: roundPart(STICK_BUTT_RADIUS_METRES, h + 0.01, 0, STICK_TOP_RADIUS_METRES / STICK_BUTT_RADIUS_METRES, 6),
      material: stick,
    },
    { geometry: roundPart(0.007, 0.03, 0.2, 0.6, 5, 1.1, STICK_BUTT_RADIUS_METRES), material: stick },
  ];
  // The wrap: three lumps of bark stacked up the head, each a little turned and off the line, widening towards the top.
  const wrap = [
    { geometry: roundPart(r * 0.62, 0.045, h, 1.3, 7, 0.2, 0.002), material: bark },
    { geometry: roundPart(r * 0.84, 0.045, h + 0.04, 1.12, 7, 0.9, 0.004), material: barkLight },
    { geometry: roundPart(r * 0.92, HEAD_LENGTH_METRES - CHAR_METRES - 0.08, h + 0.08, 1.06, 7, 1.7, 0.003), material: bark },
  ];
  // Two rope bands tie the wrap on, standing a little proud of it.
  const bands = [
    { geometry: roundPart(r * 0.86, 0.012, h + 0.03, 1.08, 8), material: rope },
    { geometry: roundPart(r * 1.02, 0.012, h + 0.095, 1.02, 8), material: rope },
  ];
  // The charred tip, narrowing to the top, where the flame stands.
  const tip = roundPart(r * 0.98, CHAR_METRES, STICK_LENGTH_METRES - CHAR_METRES, 0.72, 7, 0.5);
  const parts = [...wood, ...wrap, ...bands, { geometry: tip, material: ember }];
  const lyingParts = [...wood, ...wrap, ...bands, { geometry: tip, material: char }].map(({ geometry, material: partMaterial }) => ({
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
      for (const made of [stick, bark, barkLight, rope, char, ember]) made.dispose();
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
