// How a dug-up sapling lies on the ground in a pile: part of the draft "sapling-icon" asset in asset-manifest.json. Built in code.
// Added by regrowth ticket 02. The pile meshes in pile-meshes.ts lay it out like other things in a pile.
import * as THREE from "three";

/** The sapling's needles, its thin stem, and the ball of earth round its roots. */
const NEEDLE_COLOUR = 0x4f8a3c;
const STEM_COLOUR = 0x7a5434;
const EARTH_COLOUR = 0x5e4130;

/** One sapling's length from the root ball to its tip, in metres. */
const SAPLING_LENGTH_METRES = 0.7;

/**
 * A dug-up sapling lying on its side along z: a ball of earth at one end, a thin stem, and two cones of needles toward the tip.
 * `material` makes a material of a colour. The caller owns the geometries and materials.
 */
export function saplingPileParts(material: (colour: number) => THREE.Material): { geometry: THREE.BufferGeometry; material: THREE.Material }[] {
  const lying = (geometry: THREE.BufferGeometry, alongZ: number, radius: number) => geometry.rotateX(Math.PI / 2).translate(0, radius, alongZ);
  const half = SAPLING_LENGTH_METRES / 2;
  return [
    { geometry: new THREE.IcosahedronGeometry(0.08, 0).scale(1, 0.85, 1).translate(0, 0.07, -half + 0.08), material: material(EARTH_COLOUR) },
    { geometry: lying(new THREE.CylinderGeometry(0.012, 0.016, SAPLING_LENGTH_METRES * 0.8, 5), 0, 0.03), material: material(STEM_COLOUR) },
    { geometry: lying(new THREE.ConeGeometry(0.12, 0.3, 6), 0.02, 0.1), material: material(NEEDLE_COLOUR) },
    { geometry: lying(new THREE.ConeGeometry(0.08, 0.22, 6), half - 0.11, 0.08), material: material(NEEDLE_COLOUR) },
  ];
}
