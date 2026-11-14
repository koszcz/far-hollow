// Builds the "saw-model" asset in asset-manifest.json: the bow saw the player holds while sawing planks. A draft.
// It matches the saw in the approved "crafting-icons": a thin steel blade with big teeth, strung across the ends of a
// stick bent into a bow, and lashed on with twine at each end.
import * as THREE from "three";

/** How long the blade is, from end to end, in metres. */
export const SAW_BLADE_LENGTH_METRES = 0.55;
/** How far below the grip the tips of the teeth are, in metres. */
export const SAW_TEETH_BELOW_GRIP_METRES = 0.05;

/** How tall the blade is, above its teeth, in metres. */
const BLADE_HEIGHT_METRES = 0.028;
/** How tall each tooth is, in metres. */
const TOOTH_HEIGHT_METRES = 0.008;
/** How far apart the tips of the teeth are, in metres. */
const TOOTH_PITCH_METRES = 0.016;
/** How thick the blade is, in metres. */
const BLADE_THICKNESS_METRES = 0.003;
/** How far the bow rises above the blade at its middle, in metres. */
const BOW_RISE_METRES = 0.2;
/** The radius of the bent stick, in metres. */
const BOW_RADIUS_METRES = 0.011;
/** The bow stick reaches this far past each end of the blade, so the ends are lashed on, in metres. */
const BOW_OVERHANG_METRES = 0.02;

const STEEL_COLOUR = 0xb8c4cc;
/** The colour of the stick icon, because the frame is a stick. */
const STICK_COLOUR = 0xc08a55;
const TWINE_COLOUR = 0xeadbb0;

/** One part of the saw: its shape, its paint, and where it sits from the grip. */
export interface SawPart {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.MeshStandardMaterial;
  readonly position: THREE.Vector3;
}

/**
 * A bow saw. Its blade runs along +z from the grip, at the origin, with the teeth pointing down. The bow arcs up
 * over the blade. The hand holds the near end of the bow, where it is lashed to the blade.
 */
export function createSaw(): { readonly group: THREE.Group; readonly parts: readonly SawPart[]; dispose(): void } {
  const steel = new THREE.MeshStandardMaterial({ color: STEEL_COLOUR, metalness: 0.6, roughness: 0.4 });
  const stick = new THREE.MeshStandardMaterial({ color: STICK_COLOUR, roughness: 1, flatShading: true });
  const twine = new THREE.MeshStandardMaterial({ color: TWINE_COLOUR, roughness: 1 });
  const geometries: THREE.BufferGeometry[] = [];
  const group = new THREE.Group();
  const parts: SawPart[] = [];
  const add = (geometry: THREE.BufferGeometry, material: THREE.MeshStandardMaterial): THREE.Mesh => {
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    group.add(mesh);
    parts.push({ geometry, material, position: mesh.position });
    return mesh;
  };

  // The blade's outline in its own plane: x along the blade, y up. The teeth run along the lower edge.
  const top = -SAW_TEETH_BELOW_GRIP_METRES + TOOTH_HEIGHT_METRES + BLADE_HEIGHT_METRES;
  const bottom = -SAW_TEETH_BELOW_GRIP_METRES + TOOTH_HEIGHT_METRES;
  const outline = new THREE.Shape();
  outline.moveTo(0, top);
  outline.lineTo(SAW_BLADE_LENGTH_METRES, top);
  outline.lineTo(SAW_BLADE_LENGTH_METRES, bottom);
  for (let x = SAW_BLADE_LENGTH_METRES; x > TOOTH_PITCH_METRES / 2; x -= TOOTH_PITCH_METRES) {
    outline.lineTo(x - TOOTH_PITCH_METRES / 2, bottom - TOOTH_HEIGHT_METRES);
    outline.lineTo(Math.max(0, x - TOOTH_PITCH_METRES), bottom);
  }
  outline.lineTo(0, bottom);
  const blade = new THREE.ExtrudeGeometry(outline, { depth: BLADE_THICKNESS_METRES, bevelEnabled: false });
  // Lay the blade along +z, centred on its thickness.
  blade.translate(0, 0, -BLADE_THICKNESS_METRES / 2);
  blade.rotateY(-Math.PI / 2);
  add(blade, steel);

  // The bow: a stick bent from one end of the blade, up over it, to the other end.
  const bladeMiddleY = (top + bottom) / 2;
  const bow = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, bladeMiddleY, -BOW_OVERHANG_METRES),
    new THREE.Vector3(0, top + BOW_RISE_METRES * 2, SAW_BLADE_LENGTH_METRES / 2),
    new THREE.Vector3(0, bladeMiddleY, SAW_BLADE_LENGTH_METRES + BOW_OVERHANG_METRES),
  );
  add(new THREE.TubeGeometry(bow, 16, BOW_RADIUS_METRES, 6, false), stick);

  // A few turns of twine lash each end of the blade to the bow.
  for (const z of [0, SAW_BLADE_LENGTH_METRES]) {
    const lashing = add(new THREE.CylinderGeometry(BOW_RADIUS_METRES * 1.5, BOW_RADIUS_METRES * 1.5, 0.025, 8), twine);
    lashing.position.set(0, bladeMiddleY, z);
  }

  return {
    group,
    parts,
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      steel.dispose();
      stick.dispose();
      twine.dispose();
    },
  };
}
