// Builds the "backpack" asset in asset-manifest.json: a canvas backpack with a leather flap, a front pocket, and shoulder
// straps, worn on the player's back. It is a draft, built in code from boxes. player-mesh.ts fits it to the player's torso.
import * as THREE from "three";

const CANVAS_COLOUR = 0x8a8452;
const LEATHER_COLOUR = 0x5c3a20;
const BUCKLE_COLOUR = 0xb59a5a;

/** The backpack's size, in metres. */
const WIDTH = 0.44;
const HEIGHT = 0.48;
/** How far the backpack stands out from the player's back, in metres. */
export const BACKPACK_DEPTH = 0.2;
/** How far the backpack's top sits below the top of the torso, in metres. The big head hangs over the torso's top. */
const DROP_BELOW_SHOULDERS = 0.1;
const STRAP_WIDTH = 0.045;
const STRAP_THICKNESS = 0.02;
/** How far the straps reach down the chest, in metres. */
const STRAP_CHEST_LENGTH = 0.3;
/** How far the straps sit inside the front of the torso box, which bulges out at the belly. */
const STRAP_SINK = 0.03;

export interface Backpack {
  readonly group: THREE.Group;
  dispose(): void;
}

/**
 * Builds the backpack against the back of `torso`, the player's posed torso box, in the same space as the box.
 * The player faces +z, so the back is the -z side.
 */
export function createBackpack(torso: THREE.Box3): Backpack {
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const group = new THREE.Group();

  const canvas = material(CANVAS_COLOUR);
  const leather = material(LEATHER_COLOUR);
  const buckle = material(BUCKLE_COLOUR);

  const middleX = (torso.min.x + torso.max.x) / 2;
  const back = torso.min.z;
  const top = torso.max.y - DROP_BELOW_SHOULDERS;
  const outside = back - BACKPACK_DEPTH;

  // The bag itself.
  box(canvas, WIDTH, HEIGHT, BACKPACK_DEPTH, middleX, top - HEIGHT / 2, back - BACKPACK_DEPTH / 2);
  // The flap: over the top, and down the outside a third of the way.
  box(leather, WIDTH + 0.02, 0.03, BACKPACK_DEPTH + 0.02, middleX, top + 0.01, back - BACKPACK_DEPTH / 2);
  box(leather, WIDTH + 0.02, HEIGHT * 0.35, 0.025, middleX, top - HEIGHT * 0.175, outside - 0.0125);
  box(buckle, 0.05, 0.035, 0.015, middleX, top - HEIGHT * 0.33, outside - 0.03);
  // The front pocket, below the flap.
  box(canvas, WIDTH * 0.7, HEIGHT * 0.32, 0.06, middleX, top - HEIGHT * 0.72, outside - 0.03);
  box(leather, WIDTH * 0.72, 0.025, 0.065, middleX, top - HEIGHT * 0.57, outside - 0.03);

  // The shoulder straps come down the chest on each side of the beard. The head hides where they pass over the shoulders.
  const chestFront = torso.max.z - STRAP_SINK;
  for (const side of [-1, 1]) {
    const x = middleX + side * WIDTH * 0.42;
    box(leather, STRAP_WIDTH, STRAP_CHEST_LENGTH, STRAP_THICKNESS, x, top - STRAP_CHEST_LENGTH / 2, chestFront);
  }

  return {
    group,
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const made of materials) made.dispose();
    },
  };

  function material(color: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
    const made = new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true });
    materials.push(made);
    return made;
  }

  /** Adds a box of the given size, in metres, centred on the given point. */
  function box(paint: THREE.Material, width: number, height: number, depth: number, x: number, y: number, z: number): void {
    const shape = new THREE.BoxGeometry(width, height, depth);
    geometries.push(shape);
    const part = new THREE.Mesh(shape, paint);
    part.position.set(x, y, z);
    part.castShadow = true;
    group.add(part);
  }
}
