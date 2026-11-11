// Draws the valley with the code-built shapes listed in asset-manifest.json:
// "terrain" (approved) and "river" (draft). The terrain's painted texture
// comes from ground-texture.ts. Trees, stumps, and logs are drawn in forest-meshes.ts.
import * as THREE from "three";
import { terrainHeightAt, type Valley } from "../sim/valley";
import { createGroundTexture, GROUND_TEXTURE_TILE_METRES } from "./ground-texture";

/** The ground's main grass colour. The sky light also uses it as the colour bounced up from the ground. */
export const GROUND_COLOUR = 0x5f7f3a;
const WATER_COLOUR = 0x3a77a8;

/** The riverbed is cut 2 m deep. The water fills most of it. */
const WATER_LEVEL_ABOVE_BED_METRES = 1.5;
/** The water reaches a little past the river's width, so it meets the sloping banks without a gap. */
const WATER_OVERLAP_METRES = 2;

export interface ValleyMeshes {
  readonly group: THREE.Group;
  /** The terrain mesh, so clicks can find the spot on the ground under the pointer. */
  readonly ground: THREE.Mesh;
  dispose(): void;
}

export function createValleyMeshes(valley: Valley): ValleyMeshes {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  function track<T extends { dispose(): void }>(item: T): T {
    disposables.push(item);
    return item;
  }

  // Terrain: one mesh whose corners follow the valley's height grid.
  const segments = valley.terrain.pointsPerSide - 1;
  const groundGeometry = track(new THREE.PlaneGeometry(valley.size, valley.size, segments, segments));
  // After this turn, vertex 0 sits at x = -size / 2, z = -size / 2, matching row 0, column 0 of the height grid.
  groundGeometry.rotateX(-Math.PI / 2);
  const groundPositions = groundGeometry.getAttribute("position");
  valley.terrain.heights.forEach((height, index) => {
    groundPositions.setY(index, height);
  });
  groundGeometry.computeVertexNormals();
  const groundTexture = track(createGroundTexture());
  groundTexture.repeat.set(valley.size / GROUND_TEXTURE_TILE_METRES, valley.size / GROUND_TEXTURE_TILE_METRES);
  const groundMaterial = track(new THREE.MeshStandardMaterial({ map: groundTexture, flatShading: true }));
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  group.add(ground);

  // River: a flat strip of water along the river's path.
  const riverGeometry = track(createRiverGeometry(valley));
  const riverMaterial = track(new THREE.MeshStandardMaterial({ color: WATER_COLOUR, roughness: 0.2, side: THREE.DoubleSide }));
  group.add(new THREE.Mesh(riverGeometry, riverMaterial));

  return {
    group,
    ground,
    dispose() {
      for (const item of disposables) item.dispose();
    },
  };
}

/** A strip of water two triangles wide per path segment, following the river's path. */
function createRiverGeometry(valley: Valley): THREE.BufferGeometry {
  const { path, width } = valley.river;
  const halfWidth = width / 2 + WATER_OVERLAP_METRES;
  const positions: number[] = [];
  const indices: number[] = [];
  path.forEach((point, index) => {
    const before = path[Math.max(0, index - 1)] ?? point;
    const after = path[Math.min(path.length - 1, index + 1)] ?? point;
    // The strip's sideways direction is square to the river's flow at this point.
    const flowX = after.x - before.x;
    const flowZ = after.z - before.z;
    const length = Math.hypot(flowX, flowZ) || 1;
    const sideX = -flowZ / length;
    const sideZ = flowX / length;
    const y = terrainHeightAt(valley.terrain, point.x, point.z) + WATER_LEVEL_ABOVE_BED_METRES;
    positions.push(point.x - sideX * halfWidth, y, point.z - sideZ * halfWidth);
    positions.push(point.x + sideX * halfWidth, y, point.z + sideZ * halfWidth);
    if (index > 0) {
      const left = index * 2;
      const previousLeft = left - 2;
      indices.push(previousLeft, left, previousLeft + 1, previousLeft + 1, left, left + 1);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
