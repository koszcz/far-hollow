// How a dug-up berry bush lies on the ground in a pile: part of the draft "berry-bush-icon" asset in asset-manifest.json. Built in code.
// Added by garden ticket 01. The pile meshes in pile-meshes.ts lay it out like other things in a pile.
import * as THREE from "three";

/** The bush's leaves, its red berries, and the ball of earth round its roots. */
const LEAF_COLOUR = 0x2f6b2c;
const BERRY_COLOUR = 0xb3202e;
const EARTH_COLOUR = 0x5e4130;

/** How wide one dug-up bush is across its leaves, in metres. */
const BUSH_WIDTH_METRES = 0.5;

/**
 * A dug-up berry bush tipped on its side along z: a ball of earth at one end, and a lumpy ball of leaves dotted with berries.
 * `material` makes a material of a colour. The caller owns the geometries and materials.
 */
export function berryBushPileParts(material: (colour: number) => THREE.Material): { geometry: THREE.BufferGeometry; material: THREE.Material }[] {
  const radius = BUSH_WIDTH_METRES / 2;
  const leaves = new THREE.IcosahedronGeometry(radius, 1).scale(1, 0.75, 1.1).translate(0, radius * 0.75, 0.08);
  const earth = new THREE.IcosahedronGeometry(0.1, 0).scale(1, 0.85, 1).translate(0, 0.09, -radius - 0.02);
  const spots = [
    [0.15, 0.3, 0.2],
    [-0.12, 0.33, 0.12],
    [0.05, 0.38, -0.05],
    [-0.18, 0.2, -0.02],
    [0.2, 0.18, -0.08],
  ];
  const berries = spots.map(([x = 0, y = 0, z = 0]) => new THREE.IcosahedronGeometry(0.035, 0).translate(x, y, z + 0.08));
  return [
    { geometry: earth, material: material(EARTH_COLOUR) },
    { geometry: leaves, material: material(LEAF_COLOUR) },
    ...berries.map((geometry) => ({ geometry, material: material(BERRY_COLOUR) })),
  ];
}
