// The code-built "rolled-bedroll" (draft) in asset-manifest.json: the bedroll rolled up, lying on the ground.
// A draft: a green roll with two leather straps, using the colours of the laid "bedroll".
// The roll lies along x. The pivot is the middle of its underside, on the ground.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const ROLL_COLOUR = 0x4f6b3a;
const STRAP_COLOUR = 0x5a3a22;
const ROLL_RADIUS_METRES = 0.13;
const ROLL_LENGTH_METRES = 0.65;
const STRAP_WIDTH_METRES = 0.04;
/** The straps sit this far from the middle of the roll, in metres. */
const STRAP_OFFSET_METRES = 0.2;

export interface RolledBedrollShape {
  readonly parts: readonly { readonly geometry: THREE.BufferGeometry; readonly material: THREE.Material }[];
  dispose(): void;
}

/** A cylinder lying along x, resting on the ground. */
function lyingCylinder(radius: number, length: number, x: number): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 12);
  geometry.rotateZ(Math.PI / 2);
  geometry.translate(x, ROLL_RADIUS_METRES, 0);
  return geometry;
}

export function createRolledBedrollShape(): RolledBedrollShape {
  const roll = lyingCylinder(ROLL_RADIUS_METRES, ROLL_LENGTH_METRES, 0);
  const straps = mergeGeometries([-1, 1].map((side) => lyingCylinder(ROLL_RADIUS_METRES * 1.05, STRAP_WIDTH_METRES, side * STRAP_OFFSET_METRES)));
  const rollMaterial = new THREE.MeshStandardMaterial({ color: ROLL_COLOUR, roughness: 0.9, flatShading: true });
  const strapMaterial = new THREE.MeshStandardMaterial({ color: STRAP_COLOUR, roughness: 0.7, flatShading: true });
  return {
    parts: [
      { geometry: roll, material: rollMaterial },
      { geometry: straps, material: strapMaterial },
    ],
    dispose() {
      roll.dispose();
      straps.dispose();
      rollMaterial.dispose();
      strapMaterial.dispose();
    },
  };
}
