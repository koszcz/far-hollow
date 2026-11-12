// Draws the "valley-backdrop" asset in asset-manifest.json (draft), shaped in valley-backdrop-shape.ts:
// - The ridge's ground carries on the valley ground's painted look across the seam, then turns to forest floor.
// - Trees on the ridge use the "far-trees" shapes (approved), in one batch per tree type. They cast no shadows.
// - The river runs on through each gorge with the "river" asset's water and pebble banks (approved).
// - The far land and its mountains are shaded flat, with no shadows, and fade into the sky's haze, a little more than
//   nearer land does.
// None of it can be clicked or walked on. The scene uses `ridge` only to stop clicks that land on the ridge.
import * as THREE from "three";
import type { Terrain, Valley } from "../sim/valley";
import { createCulledBatch, type CulledBatch, type CullViews } from "./culled-batch";
import { TREE_COLOURS, treeTypeFor } from "./forest-meshes";
import { createRiverMeshes, type RiverMeshes } from "./river-meshes";
import { createFarTreeShape } from "./tree-far-shape";
import type { TreeShape } from "./tree-model";
import { createFarLandGeometry, createRidgeGeometry, RIDGE_REACH_METRES, type ValleyBackdrop } from "./valley-backdrop-shape";
import { GROUND_FRAGMENT_HEAD, groundColourGlsl, type GroundLook } from "./valley-meshes";

/** The ridge's ground turns from the valley edge's ground types to forest floor over this distance, in metres. */
const FOREST_FLOOR_FADE_METRES = 15;
/** The ridge's ground darkens to this share of its colour far up the slope, as if under thick forest. */
const RIDGE_SHADE = 0.72;
const RIDGE_SHADE_FADE_METRES = 60;
/** The haze over the far land is as thick as over land this many times as far away. */
const FAR_LAND_HAZE_SCALE = 1.3;

export interface ValleyBackdropMeshes {
  readonly group: THREE.Group;
  /** The ridge's ground. A click that lands on it starts no walk. */
  readonly ridge: THREE.Mesh;
  /** Moves the water in the gorges. Daylight runs from 0 (night) to 1 (full day). */
  update(nowSeconds: number, daylight: number): void;
  /** Draws only the ridge trees the camera sees. */
  cull(views: CullViews): void;
  dispose(): void;
}

/**
 * look is the valley ground's painted look, from createValleyMeshes. groundNormals are the valley ground mesh's
 * normals, so the ridge is lit the same as the ground where the two meet.
 */
export function createValleyBackdropMeshes(
  valley: Valley,
  backdrop: ValleyBackdrop,
  look: GroundLook,
  groundNormals: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  treeShapes: readonly TreeShape[],
): ValleyBackdropMeshes {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  function track<T extends { dispose(): void }>(item: T): T {
    disposables.push(item);
    return item;
  }

  const ridgeGeometry = track(createRidgeGeometry(valley, backdrop));
  copySeamNormals(ridgeGeometry, valley.terrain, groundNormals);
  const ridge = new THREE.Mesh(ridgeGeometry, track(createRidgeMaterial(valley, look)));
  ridge.receiveShadow = true;
  group.add(ridge);

  const farLandMaterial = track(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  // The far land counts as further away in the haze than it is, so even the near mountains fade at noon.
  // The sky's haze itself is unchanged.
  farLandMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <fog_vertex>",
      `#include <fog_vertex>\n#ifdef USE_FOG\nvFogDepth *= ${FAR_LAND_HAZE_SCALE.toFixed(2)};\n#endif`,
    );
  };
  const farLand = new THREE.Mesh(track(createFarLandGeometry(valley, backdrop)), farLandMaterial);
  group.add(farLand);

  const batches = createRidgeTrees(backdrop, treeShapes, track);
  for (const batch of batches) group.add(...batch.meshes);

  const rivers = createGorgeRivers(valley, backdrop);
  for (const river of rivers) group.add(river.group);

  return {
    group,
    ridge,
    update(nowSeconds, daylight) {
      for (const river of rivers) river.update(nowSeconds, daylight);
    },
    cull(views) {
      for (const batch of batches) batch.cull(views);
    },
    dispose() {
      for (const item of disposables) item.dispose();
      for (const batch of batches) batch.dispose();
      for (const river of rivers) river.dispose();
    },
  };
}

/** Gives the ridge's points on the valley's edge the valley ground's own normals there, so the seam is lit evenly. */
function copySeamNormals(ridge: THREE.BufferGeometry, terrain: Terrain, groundNormals: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): void {
  const positions = ridge.getAttribute("position");
  const beyondEdge = ridge.getAttribute("beyondEdge");
  const normals = ridge.getAttribute("normal");
  const half = ((terrain.pointsPerSide - 1) * terrain.spacing) / 2;
  for (let index = 0; index < positions.count; index += 1) {
    if (beyondEdge.getX(index) !== 0) continue;
    const column = Math.round((positions.getX(index) + half) / terrain.spacing);
    const row = Math.round((positions.getZ(index) + half) / terrain.spacing);
    const grid = row * terrain.pointsPerSide + column;
    normals.setXYZ(index, groundNormals.getX(grid), groundNormals.getY(grid), groundNormals.getZ(grid));
  }
  normals.needsUpdate = true;
}

/**
 * The valley ground's material, carried on past the edge. The baked ground-type map stops at the edge, so past it each
 * spot takes the edge's ground types, then fades to forest floor and darkens up the slope.
 * The painting itself is the valley ground's own, from valley-meshes.ts, so the two always match at the seam.
 */
function createRidgeMaterial(valley: Valley, look: GroundLook): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ map: look.textures.clearing });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.forestFloorMap = { value: look.textures.forestFloor };
    shader.uniforms.riverBankMap = { value: look.textures.riverBank };
    shader.uniforms.groundTypeWeights = { value: look.weights };
    shader.uniforms.valleySize = { value: valley.size };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float valleySize;\nattribute float beyondEdge;\nvarying vec2 vGroundTypeUv;\nvarying float vBeyondEdge;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvGroundTypeUv = clamp( position.xz / valleySize + 0.5, 0.0, 1.0 );\nvBeyondEdge = beyondEdge;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${GROUND_FRAGMENT_HEAD}\nvarying float vBeyondEdge;`)
      .replace(
        "#include <map_fragment>",
        groundColourGlsl(
          `groundWeights = mix( groundWeights, vec3( 1.0, 0.0, 0.0 ), smoothstep( 0.0, ${FOREST_FLOOR_FADE_METRES.toFixed(1)}, vBeyondEdge ) );`,
          `groundColour.rgb *= mix( 1.0, ${RIDGE_SHADE.toFixed(2)}, smoothstep( 0.0, ${RIDGE_SHADE_FADE_METRES.toFixed(1)}, vBeyondEdge ) );`,
        ),
      );
  };
  return material;
}

/** One culled batch per tree type, drawing each ridge tree with its type's far shape. */
function createRidgeTrees(backdrop: ValleyBackdrop, treeShapes: readonly TreeShape[], track: <T extends { dispose(): void }>(item: T) => T): CulledBatch[] {
  const material = (colour: number) => track(new THREE.MeshStandardMaterial({ color: colour, flatShading: true }));
  const trunkMaterials = { dark: material(TREE_COLOURS.trunk.dark), light: material(TREE_COLOURS.trunk.light) };
  const crownMaterials = { dark: material(TREE_COLOURS.crown.dark), light: material(TREE_COLOURS.crown.light) };
  const treesOfType = treeShapes.map(() => [] as ValleyBackdrop["trees"][number][]);
  for (const tree of backdrop.trees) treesOfType[treeTypeFor(tree.x, tree.z, treeShapes)]?.push(tree);

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const turn = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  return treeShapes.map((shape, type) => {
    const trees = treesOfType[type] ?? [];
    const far = createFarTreeShape(shape);
    track(far.trunk);
    track(far.crown);
    const batch = createCulledBatch(
      [
        { geometry: far.trunk, material: trunkMaterials[shape.trunkTone] },
        { geometry: far.crown, material: crownMaterials[shape.crownTone] },
      ],
      Math.max(1, trees.length),
      false,
    );
    trees.forEach((tree, index) => {
      position.set(tree.x, tree.y, tree.z);
      turn.setFromAxisAngle(up, tree.turn);
      scale.setScalar(tree.scale);
      batch.set(index, matrix.compose(position, turn, scale));
    });
    batch.cull();
    return batch;
  });
}

/**
 * The river's water and banks along each run out through a gorge. The river asset reads ground heights from a terrain
 * grid, so each run gets a grid around the valley, with the same spacing, that holds the gorge's ground.
 */
function createGorgeRivers(valley: Valley, backdrop: ValleyBackdrop): RiverMeshes[] {
  const { spacing } = valley.terrain;
  const half = valley.size / 2 + RIDGE_REACH_METRES;
  const pointsPerSide = Math.round((half * 2) / spacing) + 1;
  const heights: number[] = [];
  for (let row = 0; row < pointsPerSide; row += 1) {
    for (let column = 0; column < pointsPerSide; column += 1) {
      heights.push(backdrop.groundHeightAt(-half + column * spacing, -half + row * spacing));
    }
  }
  const terrain: Terrain = { pointsPerSide, spacing, heights };
  return backdrop.riverRuns.map((path) => createRiverMeshes({ ...valley, terrain, river: { ...valley.river, path } }));
}
