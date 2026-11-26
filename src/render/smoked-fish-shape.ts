// How smoked fish looks, the draft "smoked-fish-pile" asset in asset-manifest.json. Built in code.
// Added by food-keeping ticket 03. pile-meshes.ts lays it out like the other things in a pile, and drying-rack-meshes.ts hangs
// it on the rack.
// A smoked fish is the trout from the approved "fishing-piles" asset, its skin smoked a deep amber brown and its belly a dull
// gold, with no char marks, since the smoke darkens it evenly. Its pivot is the middle of its underside, its long side along z.
import { fishParts, type FishColours, type FishingPilePart } from "./fishing-pile-shapes";
import type * as THREE from "three";

/** A smoked trout: deep amber-brown skin and a dull gold belly, darker than a cooked one. */
export const SMOKED_FISH_COLOURS: FishColours = { back: 0x4f2c14, belly: 0xa8702f };

/**
 * A smoked fish lying on its side, its snout towards +z and its back towards -x.
 * `material` makes a material from a colour, and the caller disposes it. `track` hands each geometry to the caller to dispose.
 */
export function smokedFishParts(
  material: (colour: number) => THREE.Material,
  track: <T extends { dispose(): void }>(resource: T) => T,
): readonly FishingPilePart[] {
  return fishParts(material, track, SMOKED_FISH_COLOURS);
}
