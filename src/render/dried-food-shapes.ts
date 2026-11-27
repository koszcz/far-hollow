// How dried berries and a dried mushroom look, the draft "dried-food-piles" asset in asset-manifest.json. Built in code.
// Added by food-keeping ticket 02. pile-meshes.ts lays these shapes out like the other things in a pile, and
// drying-rack-meshes.ts hangs them on the rack.
// Dried berries are a small cluster of shrunken, dark wine-red berries, squashed a little flat, with no leaf.
// A dried mushroom is a flat, leathery brown cap, curled and thin, on a short pale stem. It is smaller than a fresh one.
// Each shape lies flat, its pivot at the middle of its underside.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { PreservedFood } from "../sim/backpack";

/** One part of a thing in a pile: a shape and what it is drawn with. */
export interface DriedFoodPart {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
}

/** Dried berries: darker and duller than fresh ones. */
export const DRIED_BERRY_COLOUR = 0x6e1f2a;
/** A dried mushroom's leathery cap and its pale stem. */
export const DRIED_CAP_COLOUR = 0x7a4c2c;
export const DRIED_STEM_COLOUR = 0xbfa781;

/** The dried foods this file draws. Smoked fish is drawn by smoked-fish-shape.ts. */
export type DriedFood = Exclude<PreservedFood, "smokedFish">;

/** Makes a material from a colour. The caller disposes it. */
type MakeMaterial = (colour: number) => THREE.Material;
/** Hands a geometry to the caller to dispose, and returns it. */
type Track = <T extends { dispose(): void }>(resource: T) => T;

/** Five shrunken berries, squashed a little flat, in a small cluster. */
function driedBerriesGeometry(): THREE.BufferGeometry {
  const spots: readonly (readonly [number, number, number])[] = [
    [0, 0, 0.011],
    [0.019, 0.006, 0.01],
    [-0.017, 0.009, 0.01],
    [0.004, 0.021, 0.009],
    [-0.005, -0.018, 0.01],
  ];
  return mergeGeometries(spots.map(([x, z, radius]) => new THREE.SphereGeometry(radius, 6, 4).scale(1, 0.75, 1).translate(x, radius * 0.75, z)));
}

/** A thin, curled cap: a shallow dome, wider than it is tall. */
function driedCapGeometry(): THREE.BufferGeometry {
  return new THREE.SphereGeometry(0.03, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2.4).scale(1, 0.35, 0.85).translate(0, 0.012, 0);
}

/** A short stem under the cap. */
function driedStemGeometry(): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(0.006, 0.008, 0.014, 6).translate(0, 0.007, 0);
}

/**
 * Dried berries and a dried mushroom, as parts to lie in a pile or hang on the drying rack.
 * `material` makes a material from a colour, and the caller disposes it. `track` hands each geometry to the caller to dispose.
 */
export function driedFoodParts(material: MakeMaterial, track: Track): Readonly<Record<DriedFood, readonly DriedFoodPart[]>> {
  return {
    driedBerries: [{ geometry: track(driedBerriesGeometry()), material: material(DRIED_BERRY_COLOUR) }],
    driedMushroom: [
      { geometry: track(driedStemGeometry()), material: material(DRIED_STEM_COLOUR) },
      { geometry: track(driedCapGeometry()), material: material(DRIED_CAP_COLOUR) },
    ],
  };
}
