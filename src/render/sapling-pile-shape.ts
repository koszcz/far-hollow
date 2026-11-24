// How a dug-up sapling lies on the ground in a pile: part of the approved "sapling-icon" asset in asset-manifest.json. Built in code.
// Added by regrowth ticket 02. The pile meshes in pile-meshes.ts lay it out like other things in a pile.
import * as THREE from "three";

/** The sapling's needles, a darker green for its lowest tier, its thin stem and roots, and the ball of earth around its roots. */
const NEEDLE_COLOUR = 0x4f8a3c;
const NEEDLE_DARK_COLOUR = 0x3f7330;
const STEM_COLOUR = 0x7a5434;
const EARTH_COLOUR = 0x5e4130;

/** One sapling's length from the root ball to its tip, in metres. */
const SAPLING_LENGTH_METRES = 0.7;
const EARTH_RADIUS_METRES = 0.1;

/** The tiers of needles from the bottom up: each tier's radius and length, and where its middle sits along the sapling. */
const TIERS = [
  { radius: 0.13, length: 0.26, alongZ: -0.02 },
  { radius: 0.1, length: 0.22, alongZ: 0.12 },
  { radius: 0.065, length: 0.17, alongZ: 0.25 },
] as const;

/** The roots poking out of the back of the earth ball: each root's sideways and upward lean, as a share of its length. */
const ROOT_LEANS = [
  [0.5, 0.3],
  [-0.6, 0.2],
  [0.1, 0.7],
] as const;
const ROOT_LENGTH_METRES = 0.1;

/**
 * A dug-up sapling lying on its side along z: a ball of earth at one end with roots poking out of it, a thin stem,
 * and three full tiers of needles toward the tip. `material` makes a material of a colour. The caller owns the geometries and materials.
 */
export function saplingPileParts(material: (colour: number) => THREE.Material): { geometry: THREE.BufferGeometry; material: THREE.Material }[] {
  const lying = (geometry: THREE.BufferGeometry, alongZ: number, radius: number) => geometry.rotateX(Math.PI / 2).translate(0, radius, alongZ);
  const half = SAPLING_LENGTH_METRES / 2;
  const earthZ = -half + EARTH_RADIUS_METRES;
  const earthY = EARTH_RADIUS_METRES * 0.85;
  const roots = ROOT_LEANS.map(([sideways, up]) => {
    const direction = new THREE.Vector3(sideways, up, -1).normalize();
    const root = new THREE.CylinderGeometry(0.004, 0.008, ROOT_LENGTH_METRES, 4).translate(0, ROOT_LENGTH_METRES / 2, 0);
    root.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction));
    return root.translate(0, earthY, earthZ - EARTH_RADIUS_METRES * 0.6);
  });
  return [
    { geometry: new THREE.IcosahedronGeometry(EARTH_RADIUS_METRES, 1).scale(1, 0.85, 1).translate(0, earthY, earthZ), material: material(EARTH_COLOUR) },
    ...roots.map((geometry) => ({ geometry, material: material(STEM_COLOUR) })),
    { geometry: lying(new THREE.CylinderGeometry(0.012, 0.016, SAPLING_LENGTH_METRES * 0.8, 5), 0, 0.03), material: material(STEM_COLOUR) },
    ...TIERS.map(({ radius, length, alongZ }, index) => ({
      geometry: lying(new THREE.ConeGeometry(radius, length, 8), alongZ, radius),
      material: material(index === 0 ? NEEDLE_DARK_COLOUR : NEEDLE_COLOUR),
    })),
  ];
}
