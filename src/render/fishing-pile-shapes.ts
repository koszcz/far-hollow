// How fishing gear looks lying in a pile, the draft "fishing-piles" asset in asset-manifest.json. Built in code.
// Added by fishing ticket 01. pile-meshes.ts lays these shapes out like the other things in a pile.
// The fishing line is a flat wooden winder with pale line wound round its middle.
// The fishing rod is a long, thin rod, thicker at the butt, with a short length of line trailing from its tip.
// Each shape lies flat, its pivot at the middle of its underside, its long side along z.
import * as THREE from "three";
import type { FishingContent } from "../sim/backpack";

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

const WOOD_COLOUR = 0x9b7350;
const LINE_COLOUR = 0xe8e2cc;

/**
 * The fishing line and the fishing rod, as parts to lie in a pile.
 * `material` makes a material from a colour, and the caller disposes it. `track` hands each geometry to the caller to dispose.
 */
export function fishingPileParts(
  material: (colour: number) => THREE.Material,
  track: <T extends { dispose(): void }>(resource: T) => T,
): Readonly<Record<FishingContent, readonly FishingPilePart[]>> {
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
  };
}
