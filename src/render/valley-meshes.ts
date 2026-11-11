// Draws the valley with the code-built placeholder shapes approved in asset-manifest.json:
// "terrain", "river", and "trees".
import * as THREE from "three";
import { treeEntities, type EntityStore } from "../sim/entities";
import { terrainHeightAt, type Valley } from "../sim/valley";

export const GROUND_COLOUR = 0x5f7f3a;
const WATER_COLOUR = 0x3a77a8;
const TRUNK_COLOUR = 0x6b4a2b;
const CROWN_COLOUR = 0x2f5a2a;

/** The riverbed is cut 2 m deep. The water fills most of it. */
const WATER_LEVEL_ABOVE_BED_METRES = 1.5;
/** The water reaches a little past the river's width, so it meets the sloping banks without a gap. */
const WATER_OVERLAP_METRES = 2;

const TRUNK_HEIGHT_METRES = 3;
const TRUNK_RADIUS_METRES = 0.3;
const CROWN_HEIGHT_METRES = 6;
const CROWN_RADIUS_METRES = 1.6;
/** Each tree is drawn between these sizes, so the forest does not look copy-pasted. */
const TREE_MIN_SCALE = 0.8;
const TREE_MAX_SCALE = 1.25;

export interface ValleyMeshes {
  readonly group: THREE.Group;
  /** The terrain mesh, so clicks can find the spot on the ground under the pointer. */
  readonly ground: THREE.Mesh;
  dispose(): void;
}

export function createValleyMeshes(valley: Valley, entities: EntityStore): ValleyMeshes {
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

  // River: a flat strip of water along the river's path.
  const riverGeometry = track(createRiverGeometry(valley));
  const riverMaterial = track(new THREE.MeshStandardMaterial({ color: WATER_COLOUR, roughness: 0.2, side: THREE.DoubleSide }));
  group.add(new THREE.Mesh(riverGeometry, riverMaterial));

  // Trees: one batch for every trunk and one for every crown, so thousands of trees take two draw calls.
  const trees = treeEntities(entities).entities;
  const trunkGeometry = track(new THREE.CylinderGeometry(TRUNK_RADIUS_METRES * 0.8, TRUNK_RADIUS_METRES, TRUNK_HEIGHT_METRES, 6));
  trunkGeometry.translate(0, TRUNK_HEIGHT_METRES / 2, 0);
  const crownGeometry = track(new THREE.ConeGeometry(CROWN_RADIUS_METRES, CROWN_HEIGHT_METRES, 7));
  crownGeometry.translate(0, TRUNK_HEIGHT_METRES + CROWN_HEIGHT_METRES / 2 - 0.5, 0);
  const trunkMaterial = track(new THREE.MeshStandardMaterial({ color: TRUNK_COLOUR, flatShading: true }));
  const crownMaterial = track(new THREE.MeshStandardMaterial({ color: CROWN_COLOUR, flatShading: true }));
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, trees.length);
  const crowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, trees.length);
  track(trunks);
  track(crowns);

  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  trees.forEach((tree, index) => {
    const look = lookFor(tree.position.x, tree.position.z);
    rotation.setFromAxisAngle(up, look * Math.PI * 2);
    scale.setScalar(TREE_MIN_SCALE + (TREE_MAX_SCALE - TREE_MIN_SCALE) * look);
    position.set(tree.position.x, tree.position.y, tree.position.z);
    matrix.compose(position, rotation, scale);
    trunks.setMatrixAt(index, matrix);
    crowns.setMatrixAt(index, matrix);
  });
  trunks.computeBoundingSphere();
  crowns.computeBoundingSphere();
  group.add(trunks, crowns);

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

/** A steady value from 0 to 1 for a spot, used to vary each tree's size and turn. It only affects drawing. */
function lookFor(x: number, z: number): number {
  const value = Math.sin(x * 12.9898 + z * 78.233) * 43_758.5453;
  return value - Math.floor(value);
}
