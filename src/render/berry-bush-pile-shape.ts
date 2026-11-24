// How a dug-up berry bush lies on the ground in a pile: part of the approved "berry-bush-icon" asset in asset-manifest.json. Built in code.
// Added by garden ticket 01. The pile meshes in pile-meshes.ts lay it out like other things in a pile.
import * as THREE from "three";

/** The bush's leaves, its red berries, and the ball of earth round its roots. */
const LEAF_COLOUR = 0x2f6b2c;
const BERRY_COLOUR = 0xb3202e;
const EARTH_COLOUR = 0x5e4130;

const BERRY_RADIUS_METRES = 0.035;

/** The three lumps of leaves that make up the bush: each lump's middle and radius, in metres. The bush is about 0.5 m across. */
const LUMPS = [
  { x: 0, y: 0.17, z: 0.02, radius: 0.18 },
  { x: 0.14, y: 0.14, z: 0.17, radius: 0.15 },
  { x: -0.13, y: 0.13, z: 0.15, radius: 0.14 },
] as const;

/** Where the berries sit: which lump each is on, and the direction from that lump's middle to the berry. */
const BERRY_SPOTS = [
  { lump: 0, direction: [0.3, 1, -0.2] },
  { lump: 0, direction: [-0.7, 0.6, -0.3] },
  { lump: 1, direction: [0.6, 0.7, 0.3] },
  { lump: 1, direction: [0.2, 0.4, 1] },
  { lump: 2, direction: [-0.5, 0.8, 0.4] },
  { lump: 2, direction: [-0.9, 0.2, 0.2] },
] as const;

/** The ball of earth round the roots, tucked into the foot of the bush where it was dug up. */
const EARTH = { y: 0.1, z: -0.2, radius: 0.11 } as const;

/**
 * A dug-up berry bush tipped on its side along z: three lumps of leaves dotted with berries, with a ball of earth tucked
 * into its foot. `material` makes a material of a colour. The caller owns the geometries and materials.
 */
export function berryBushPileParts(material: (colour: number) => THREE.Material): { geometry: THREE.BufferGeometry; material: THREE.Material }[] {
  const leaves = LUMPS.map(({ x, y, z, radius }) => new THREE.IcosahedronGeometry(radius, 1).scale(1, 0.85, 1).translate(x, y, z));
  const earth = new THREE.IcosahedronGeometry(EARTH.radius, 1).scale(1, 0.85, 1).translate(0, EARTH.y, EARTH.z);
  const berries = BERRY_SPOTS.map(({ lump, direction: [dx, dy, dz] }) => {
    const { x, y, z, radius } = LUMPS[lump];
    const spot = new THREE.Vector3(dx, dy * 0.85, dz).normalize().multiplyScalar(radius * 0.95);
    return new THREE.IcosahedronGeometry(BERRY_RADIUS_METRES, 0).translate(x + spot.x, y + spot.y, z + spot.z);
  });
  return [
    { geometry: earth, material: material(EARTH_COLOUR) },
    ...leaves.map((geometry) => ({ geometry, material: material(LEAF_COLOUR) })),
    ...berries.map((geometry) => ({ geometry, material: material(BERRY_COLOUR) })),
  ];
}
