// How fishing gear and fish look lying in a pile, the draft "fishing-piles" asset in asset-manifest.json. Built in code.
// Added by fishing ticket 01. Fishing ticket 02 added raw fish, and ticket 03 cooked fish. pile-meshes.ts lays these shapes out
// like the other things in a pile.
// The fishing line is a flat wooden winder with pale line wound round its middle.
// The fishing rod is a long, thin rod, thicker at the butt, with a short length of line trailing from its tip.
// A raw fish is a trout lying on its side: a grey-green back, a pale belly, a dark eye, and a flat tail.
// A cooked fish is the same trout, its skin browned and its belly golden.
// Each shape lies flat, its pivot at the middle of its underside, its long side along z.
import * as THREE from "three";
import type { Fish, FishingContent } from "../sim/backpack";

/** One part of a thing in a pile: a shape and what it is drawn with. */
export interface FishingPilePart {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
}

/** How long the fishing rod is, in metres. It is made of two sticks joined end to end. */
const ROD_LENGTH_METRES = 1.5;
const ROD_TIP_RADIUS_METRES = 0.006;
const ROD_BUTT_RADIUS_METRES = 0.014;
/** The line that trails from the rod's tip, in metres. */
const TRAILING_LINE_METRES = 0.3;
const LINE_RADIUS_METRES = 0.002;

/** How long a raw fish is from snout to tail tip, in metres. */
export const FISH_LENGTH_METRES = 0.3;
const FISH_BODY_LENGTH_METRES = 0.24;
/** How deep the fish's body is from back to belly, and how thick it is from side to side, in metres. */
const FISH_DEPTH_METRES = 0.07;
export const FISH_THICKNESS_METRES = 0.035;

const WOOD_COLOUR = 0x9b7350;
const LINE_COLOUR = 0xe8e2cc;
const FISH_BACK_COLOUR = 0x6f8a76;
const FISH_BELLY_COLOUR = 0xd8cdb4;
const FISH_EYE_COLOUR = 0x231f1c;

/** The colours of a fish's back and belly. */
export interface FishColours {
  readonly back: number;
  readonly belly: number;
}

/** A raw trout: a grey-green back and a pale belly. */
export const RAW_FISH_COLOURS: FishColours = { back: FISH_BACK_COLOUR, belly: FISH_BELLY_COLOUR };
/** A cooked trout: browned, crisp skin and a golden belly. */
export const COOKED_FISH_COLOURS: FishColours = { back: 0x6b4526, belly: 0xc9944f };

/** Makes a material from a colour. The caller disposes it. */
type MakeMaterial = (colour: number) => THREE.Material;
/** Hands a geometry to the caller to dispose, and returns it. */
type Track = <T extends { dispose(): void }>(resource: T) => T;

/**
 * The fishing line, the fishing rod, raw fish, and cooked fish, as parts to lie in a pile.
 * `material` makes a material from a colour, and the caller disposes it. `track` hands each geometry to the caller to dispose.
 */
export function fishingPileParts(material: MakeMaterial, track: Track): Readonly<Record<FishingContent | Fish, readonly FishingPilePart[]>> {
  const wood = material(WOOD_COLOUR);
  const line = material(LINE_COLOUR);
  const rod = new THREE.CylinderGeometry(ROD_TIP_RADIUS_METRES, ROD_BUTT_RADIUS_METRES, ROD_LENGTH_METRES, 6)
    .rotateX(Math.PI / 2)
    .translate(0, ROD_BUTT_RADIUS_METRES, 0);
  // The tip of the rod points to +z after the turn above. The line runs on from the tip and bends a little to one side.
  const trailing = new THREE.CylinderGeometry(LINE_RADIUS_METRES, LINE_RADIUS_METRES, TRAILING_LINE_METRES, 4)
    .rotateX(Math.PI / 2)
    .rotateY(0.5)
    .translate(Math.sin(0.5) * (TRAILING_LINE_METRES / 2), LINE_RADIUS_METRES, ROD_LENGTH_METRES / 2 + Math.cos(0.5) * (TRAILING_LINE_METRES / 2));
  return {
    fishingLine: [
      // The winder: a flat stick with a crossbar at each end, so the line cannot slip off.
      { geometry: track(new THREE.BoxGeometry(0.03, 0.01, 0.1).translate(0, 0.005, 0)), material: wood },
      { geometry: track(new THREE.BoxGeometry(0.06, 0.01, 0.015).translate(0, 0.005, 0.045)), material: wood },
      { geometry: track(new THREE.BoxGeometry(0.06, 0.01, 0.015).translate(0, 0.005, -0.045)), material: wood },
      // The line wound round the winder's middle.
      { geometry: track(new THREE.BoxGeometry(0.036, 0.016, 0.06).translate(0, 0.008, 0)), material: line },
    ],
    fishingRod: [
      { geometry: track(rod), material: wood },
      { geometry: track(trailing), material: line },
    ],
    rawFish: rawFishParts(material, track),
    cookedFish: fishParts(material, track, COOKED_FISH_COLOURS),
  };
}

/**
 * A raw fish lying on its side, its snout towards +z and its back towards -x. Its pivot is the middle of its underside.
 * The fishing animation hangs the same fish from the line as the player lifts it out of the water.
 */
export function rawFishParts(material: MakeMaterial, track: Track): readonly FishingPilePart[] {
  return fishParts(material, track, RAW_FISH_COLOURS);
}

/**
 * A fish lying on its side in these colours, its snout towards +z and its back towards -x. Its pivot is the middle of its underside.
 * The parts come in this order: the body and the tail in the back colour, the belly, then the eye.
 * The fish on a campfire use the same shape, and darken from raw to cooked.
 */
export function fishParts(material: MakeMaterial, track: Track, colours: FishColours): readonly FishingPilePart[] {
  const back = material(colours.back);
  const belly = material(colours.belly);
  const eye = material(FISH_EYE_COLOUR);
  const half = FISH_THICKNESS_METRES / 2;
  const tailLength = (FISH_LENGTH_METRES - FISH_BODY_LENGTH_METRES) * 1.4;
  // The body sits forward of the middle, so the snout and the tail tip lie at the two ends of the fish's length.
  const bodyMiddle = FISH_LENGTH_METRES / 2 - FISH_BODY_LENGTH_METRES / 2;
  const body = new THREE.SphereGeometry(0.5, 12, 8).scale(FISH_DEPTH_METRES, FISH_THICKNESS_METRES, FISH_BODY_LENGTH_METRES).translate(0, half, bodyMiddle);
  // The pale belly shows along the lower side of the body.
  const underside = new THREE.SphereGeometry(0.5, 12, 8)
    .scale(FISH_DEPTH_METRES * 0.7, FISH_THICKNESS_METRES * 1.04, FISH_BODY_LENGTH_METRES * 0.85)
    .translate(FISH_DEPTH_METRES * 0.2, half, bodyMiddle);
  // A flat fan for the tail, widest at its tip, behind the body.
  const tail = new THREE.ConeGeometry(FISH_DEPTH_METRES * 0.6, tailLength, 3)
    .rotateX(-Math.PI / 2)
    .scale(1, 0.15, 1)
    .translate(0, half, -FISH_LENGTH_METRES / 2 + tailLength / 2);
  const eyeBall = new THREE.SphereGeometry(0.006, 6, 4).translate(
    -FISH_DEPTH_METRES * 0.12,
    FISH_THICKNESS_METRES * 0.9,
    bodyMiddle + FISH_BODY_LENGTH_METRES * 0.36,
  );
  return [
    { geometry: track(body), material: back },
    { geometry: track(underside), material: belly },
    { geometry: track(tail), material: back },
    { geometry: track(eyeBall), material: eye },
  ];
}
