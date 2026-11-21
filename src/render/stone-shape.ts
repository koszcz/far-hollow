// How one stone looks lying in a pile, part of the draft "stone" asset in asset-manifest.json. Built in code.
// Added by fireplace ticket 01. pile-meshes.ts lays stones out like the other things in a pile.
// A stone is a rounded river stone, about a fist and a half across: a low, lumpy, grey boulder shape with flat faces.
// Its pivot is the middle of its underside.
import * as THREE from "three";

/** One part of a stone in a pile: a shape and what it is drawn with. */
export interface StonePart {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
}

/** How wide a stone is, how long, and how tall, in metres. */
const STONE_WIDTH_METRES = 0.16;
const STONE_LENGTH_METRES = 0.2;
const STONE_HEIGHT_METRES = 0.1;
/** A wet river stone: mid grey with a little blue. */
const STONE_COLOUR = 0x8a8d8f;
/** How far each corner moves in or out, as a share of the stone's size, so it looks hand-picked rather than cut. */
const LUMP_SHARE = 0.06;

/** Makes a material from a colour. The caller disposes it. */
type MakeMaterial = (colour: number) => THREE.Material;
/** Hands a geometry to the caller to dispose, and returns it. */
type Track = <T extends { dispose(): void }>(resource: T) => T;

/** One stone, as parts to lie in a pile. `material` makes a material from a colour, and `track` hands each geometry to the caller to dispose. */
export function stonePileParts(material: MakeMaterial, track: Track): readonly StonePart[] {
  return [{ geometry: track(createStoneGeometry()), material: material(STONE_COLOUR) }];
}

/** A low, lumpy stone with flat faces, resting on y = 0. The same every time. */
export function createStoneGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(0.5, 1);
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  // Push each corner in or out by a fixed amount taken from where it is, so shared corners stay joined.
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const lump = 1 + LUMP_SHARE * Math.sin(x * 12.9 + y * 7.3 + z * 4.1);
    position.setXYZ(index, x * lump, y * lump, z * lump);
  }
  geometry.scale(STONE_WIDTH_METRES, STONE_HEIGHT_METRES, STONE_LENGTH_METRES);
  geometry.computeBoundingBox();
  const bottom = geometry.boundingBox?.min.y ?? 0;
  geometry.translate(0, -bottom, 0);
  geometry.computeVertexNormals();
  return geometry;
}
