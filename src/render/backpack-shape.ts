// Builds the "backpack" asset in asset-manifest.json: a rounded canvas rucksack with a leather flap and brass buckle,
// a front pocket, a side pocket, a rolled blanket strapped across the top, and shoulder straps that curve over the
// shoulders and run down the chest. It is approved, and built in code with soft rounded shapes that match the player model.
// player-mesh.ts fits it to the player's torso.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const CANVAS_COLOUR = 0x7f7a48;
const POCKET_COLOUR = 0x6f6a3e;
const LEATHER_COLOUR = 0x5c3a20;
const BUCKLE_COLOUR = 0xc9a659;
const BLANKET_COLOUR = 0xb8a47c;

/** The bag's size, in metres, without the blanket on top. */
const WIDTH = 0.34;
const HEIGHT = 0.42;
/** How far the backpack stands out from the player's back, in metres, without its front pocket. */
export const BACKPACK_DEPTH = 0.18;
/** How round the bag's edges are, in metres. */
const CORNER = 0.06;
/** How far the bag's top sits below the top of the torso, in metres. The big head hangs over the torso's top. */
const DROP_BELOW_SHOULDERS = 0.12;
/** The rolled blanket across the top of the bag, in metres. */
const BLANKET_RADIUS = 0.055;
const BLANKET_LENGTH = 0.3;
const STRAP_WIDTH = 0.045;
const STRAP_THICKNESS = 0.022;
/** How far the straps reach down the chest, in metres. */
const STRAP_CHEST_LENGTH = 0.28;
/** How far the straps sit inside the front of the torso box, which bulges out at the belly. */
const STRAP_SINK = 0.03;
/** How far the straps sit apart from the middle of the back, as a share of the bag's width. */
const STRAP_SPREAD = 0.36;

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
  const pocketCanvas = material(POCKET_COLOUR);
  const leather = material(LEATHER_COLOUR);
  const buckle = material(BUCKLE_COLOUR, 0.5);
  const blanket = material(BLANKET_COLOUR);

  const middleX = (torso.min.x + torso.max.x) / 2;
  const back = torso.min.z;
  const top = torso.max.y - DROP_BELOW_SHOULDERS;
  const outside = back - BACKPACK_DEPTH;
  const middleZ = back - BACKPACK_DEPTH / 2;

  // The bag itself.
  roundedBox(canvas, WIDTH, HEIGHT, BACKPACK_DEPTH, CORNER, middleX, top - HEIGHT / 2, middleZ);

  // The flap: over the top, and down the outside about a third of the way, with a strap and buckle at its tip.
  roundedBox(leather, WIDTH + 0.02, 0.04, BACKPACK_DEPTH + 0.02, 0.018, middleX, top - 0.01, middleZ);
  const flapLength = HEIGHT * 0.38;
  roundedBox(leather, WIDTH * 0.92, flapLength, 0.03, 0.014, middleX, top - flapLength / 2, outside - 0.004);
  roundedBox(leather, 0.04, 0.09, 0.016, 0.006, middleX, top - flapLength - 0.02, outside - 0.012);
  roundedBox(buckle, 0.055, 0.045, 0.02, 0.008, middleX, top - flapLength + 0.005, outside - 0.022);

  // The front pocket, below the flap.
  const pocketHeight = HEIGHT * 0.34;
  const pocketY = top - HEIGHT + pocketHeight / 2 + 0.04;
  roundedBox(pocketCanvas, WIDTH * 0.66, pocketHeight, 0.06, 0.025, middleX, pocketY, outside - 0.02);
  roundedBox(leather, WIDTH * 0.68, 0.03, 0.066, 0.01, middleX, pocketY + pocketHeight / 2 - 0.012, outside - 0.02);

  // A side pocket on the left, away from the log carried on the right shoulder.
  const sideX = middleX + WIDTH / 2 + 0.015;
  roundedBox(pocketCanvas, 0.05, HEIGHT * 0.36, BACKPACK_DEPTH * 0.6, 0.018, sideX, top - HEIGHT * 0.66, middleZ);
  roundedBox(leather, 0.054, 0.025, BACKPACK_DEPTH * 0.62, 0.008, sideX, top - HEIGHT * 0.5, middleZ);

  // The rolled blanket on top, held by two leather straps.
  const blanketY = top + 0.01 + BLANKET_RADIUS;
  const blanketZ = middleZ - 0.01;
  cylinder(blanket, BLANKET_RADIUS, BLANKET_LENGTH, middleX, blanketY, blanketZ);
  for (const side of [-1, 1]) {
    cylinder(leather, BLANKET_RADIUS + 0.008, 0.03, middleX + side * BLANKET_LENGTH * 0.3, blanketY, blanketZ);
  }

  // The shoulder straps arch over the shoulders from the back, then come down the chest on each side of the beard.
  const chestFront = torso.max.z - STRAP_SINK;
  const arch = (chestFront - back) / 2;
  for (const side of [-1, 1]) {
    const x = middleX + side * WIDTH * STRAP_SPREAD;
    shoulderArch(x, top, (chestFront + back) / 2, arch);
    roundedBox(leather, STRAP_WIDTH, STRAP_CHEST_LENGTH, STRAP_THICKNESS, 0.008, x, top - STRAP_CHEST_LENGTH / 2, chestFront);
    roundedBox(buckle, STRAP_WIDTH + 0.01, 0.03, STRAP_THICKNESS + 0.008, 0.006, x, top - STRAP_CHEST_LENGTH * 0.6, chestFront);
  }

  return {
    group,
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const made of materials) made.dispose();
    },
  };

  function material(color: THREE.ColorRepresentation, roughness = 0.95): THREE.MeshStandardMaterial {
    const made = new THREE.MeshStandardMaterial({ color, roughness });
    materials.push(made);
    return made;
  }

  function place(shape: THREE.BufferGeometry, paint: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
    geometries.push(shape);
    const part = new THREE.Mesh(shape, paint);
    part.position.set(x, y, z);
    part.castShadow = true;
    group.add(part);
    return part;
  }

  /** Adds a box with rounded edges of the given size, in metres, centred on the given point. */
  function roundedBox(paint: THREE.Material, width: number, height: number, depth: number, radius: number, x: number, y: number, z: number): void {
    place(new RoundedBoxGeometry(width, height, depth, 2, radius), paint, x, y, z);
  }

  /** Adds a cylinder lying along x, centred on the given point. */
  function cylinder(paint: THREE.Material, radius: number, length: number, x: number, y: number, z: number): void {
    const part = place(new THREE.CylinderGeometry(radius, radius, length, 14), paint, x, y, z);
    part.rotation.z = Math.PI / 2;
  }

  /** Adds a strap that arches over the shoulder from the back to the chest, as a squashed half ring. */
  function shoulderArch(x: number, y: number, z: number, reach: number): void {
    const shape = new THREE.TorusGeometry(reach, STRAP_THICKNESS * 0.8, 6, 12, Math.PI);
    shape.scale(1, 0.55, STRAP_WIDTH / (STRAP_THICKNESS * 1.6));
    const part = place(shape, leather, x, y, z);
    part.rotation.y = Math.PI / 2;
  }
}
