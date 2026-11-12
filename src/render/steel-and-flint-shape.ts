// The code-built "steel-and-flint" (approved) in asset-manifest.json: the fire-lighting kit lying on the ground.
// A C-shaped steel of dark blued steel: a straight striking bar along the front, with each end curled back into a loop.
// A shard of dark grey flint lies just behind it. Together they are about 11 cm wide and 8 cm deep.
// Seen from above, x runs to the right and +z is the front. The pivot is the middle of the pair, on the ground.
import * as THREE from "three";

const STEEL_COLOUR = 0x6a7684;
const FLINT_COLOUR = 0x3b3d44;
/** The steel bar is this wide, seen from above, in metres. */
const BAR_WIDTH_METRES = 0.008;
/** The steel bar is this thick, from the ground up, in metres. */
const BAR_THICKNESS_METRES = 0.004;
/** The flint shard's size along x, up, and z, in metres. */
const FLINT_SIZE_METRES = { x: 0.045, y: 0.016, z: 0.032 } as const;

export interface SteelAndFlintShape {
  readonly parts: readonly { readonly geometry: THREE.BufferGeometry; readonly material: THREE.Material }[];
  dispose(): void;
}

/** The middle line of the steel, seen from above: the striking bar, then a loop curling back at each end. */
function steelPath(): THREE.CatmullRomCurve3 {
  const right: readonly (readonly [number, number])[] = [
    [0.03, 0.022],
    [0.045, 0.018],
    [0.052, 0.006],
    [0.047, -0.006],
    [0.036, -0.008],
    [0.03, -0.001],
    [0.034, 0.006],
  ];
  const points = [...right.map(([x, z]) => [-x, z] as const).reverse(), [0, 0.023] as const, ...right];
  return new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)));
}

function steelGeometry(): THREE.BufferGeometry {
  const radius = BAR_WIDTH_METRES / 2;
  const geometry = new THREE.TubeGeometry(steelPath(), 48, radius, 6, false);
  // Flatten the round tube into a flat bar, and lay it on the ground.
  geometry.scale(1, BAR_THICKNESS_METRES / BAR_WIDTH_METRES, 1);
  geometry.translate(0, BAR_THICKNESS_METRES / 2, 0);
  return geometry;
}

/** A chipped shard of flint: a flattened, uneven twelve-sided stone with sharp facets. */
function flintGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(0.5, 0);
  const position = geometry.getAttribute("position");
  // Push each corner in or out a little, so the shard looks knapped rather than round.
  const nudges = [1.0, 0.82, 1.12, 0.9, 1.05, 0.78, 1.15, 0.95, 0.85, 1.08, 0.92, 1.1];
  const corner = new THREE.Vector3();
  const seen: THREE.Vector3[] = [];
  for (let index = 0; index < position.count; index++) {
    corner.fromBufferAttribute(position, index);
    let which = seen.findIndex((point) => point.distanceTo(corner) < 1e-4);
    if (which < 0) {
      seen.push(corner.clone());
      which = seen.length - 1;
    }
    corner.multiplyScalar(nudges[which % nudges.length] ?? 1);
    position.setXYZ(index, corner.x, corner.y, corner.z);
  }
  geometry.computeVertexNormals();
  geometry.scale(FLINT_SIZE_METRES.x, FLINT_SIZE_METRES.y, FLINT_SIZE_METRES.z);
  geometry.rotateY(0.35);
  geometry.computeBoundingBox();
  const lowest = geometry.boundingBox?.min.y ?? 0;
  geometry.translate(0.006, -lowest, -0.03);
  return geometry;
}

export function createSteelAndFlintShape(): SteelAndFlintShape {
  const steel = new THREE.MeshStandardMaterial({ color: STEEL_COLOUR, metalness: 0.7, roughness: 0.35, flatShading: true });
  const flint = new THREE.MeshStandardMaterial({ color: FLINT_COLOUR, roughness: 0.3, flatShading: true });
  const parts = [
    { geometry: steelGeometry(), material: steel },
    { geometry: flintGeometry(), material: flint },
  ];
  // Centre the pair front to back: the steel reaches further forward than the flint reaches back.
  for (const part of parts) part.geometry.translate(0, 0, 0.01);
  return {
    parts,
    dispose() {
      for (const part of parts) {
        part.geometry.dispose();
        part.material.dispose();
      }
    },
  };
}
