// Draws the valley's ground with the code-built draft shape listed in asset-manifest.json as "terrain".
// The river is drawn in river-meshes.ts. Trees, stumps, and logs are drawn in forest-meshes.ts.
import * as THREE from "three";
import type { Valley } from "../sim/valley";

export const GROUND_COLOUR = 0x5f7f3a;

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
  const groundMaterial = track(new THREE.MeshStandardMaterial({ color: GROUND_COLOUR, flatShading: true }));
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  group.add(ground);

  return {
    group,
    ground,
    dispose() {
      for (const item of disposables) item.dispose();
    },
  };
}
