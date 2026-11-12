// Draws the undergrowth: the "grass", "ferns", "flowers", and "pebbles" assets in asset-manifest.json.
// undergrowth-layout.ts decides where each plant grows. undergrowth-models.ts loads the shapes.
// - Each model is one batch (an instanced mesh), so thousands of plants cost a few dozen draw calls.
// - Only patches near where the camera looks are grown and drawn. Plants shrink into the ground as they near the edge
//   of the drawn area, so they never pop in or out.
// - Plants under anything the player has placed are not drawn. camp-footprints.ts decides which spots are covered.
// - Undergrowth is only for looks. Nothing here is picked, saved, or seen by game logic, and it casts no shadows.
import * as THREE from "three";
import type { EntityStore, Vec3 } from "../sim/entities";
import { createGroundMap, type GroundMap } from "../sim/ground-types";
import { terrainHeightAt, type Valley } from "../sim/valley";
import { campFootprints, isUnderCamp, sameFootprints, type CampFootprint } from "./camp-footprints";
import { growUndergrowthPatch, UNDERGROWTH_PATCH_METRES, type UndergrowthKind, type UndergrowthItem } from "./undergrowth-layout";
import type { UndergrowthShape } from "./undergrowth-models";

/** Undergrowth is drawn out to this distance from where the camera looks, in metres. */
export const UNDERGROWTH_DRAW_METRES = 80;
/** Plants start shrinking this far from where the camera looks, and are gone at the draw distance, in metres. */
const FADE_START_METRES = 64;

/** Which models each kind of undergrowth uses, by model name, and how big it is compared with its model. */
const LOOK_BY_KIND: Readonly<Record<UndergrowthKind, { readonly models: RegExp; readonly size: number }>> = {
  sparseGrass: { models: /^grass_tuft/, size: 0.8 },
  grassTuft: { models: /^grass_tuft/, size: 1 },
  tallGrass: { models: /^grass_tall/, size: 1 },
  fern: { models: /^fern_/, size: 1 },
  flower: { models: /^flower_/, size: 1 },
  smallRock: { models: /^rock_small(?!Flat)/, size: 0.7 },
  stone: { models: /^stone_small(?!Flat)/, size: 0.9 },
  flatPebble: { models: /^(rock|stone)_smallFlat/, size: 0.6 },
};

export interface UndergrowthMeshes {
  readonly group: THREE.Group;
  /**
   * Grows and draws the undergrowth around `focus`, where the camera looks. Call it every frame.
   * It draws again when the focus enters a new patch or when the player places or removes something.
   */
  update(focus: Readonly<Vec3>): void;
  dispose(): void;
}

/**
 * The material an undergrowth model is drawn with. Each model carries its own colours as vertex colours.
 * Models are shaded flat, unless the shape asks to be lit by its own normals, like the grass.
 */
export function createUndergrowthMaterial(shape: Pick<UndergrowthShape, "ownNormals">): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: shape.ownNormals !== true });
}

export function createUndergrowthMeshes(valley: Valley, shapes: readonly UndergrowthShape[], entities: EntityStore): UndergrowthMeshes {
  const group = new THREE.Group();
  group.name = "undergrowth";
  const groundMap: GroundMap = createGroundMap(valley);
  const patchesPerSide = Math.ceil(valley.size / UNDERGROWTH_PATCH_METRES);

  const focusUniform = { value: new THREE.Vector2() };
  const flatMaterial = createUndergrowthMaterial({ ownNormals: false });
  const ownNormalsMaterial = createUndergrowthMaterial({ ownNormals: true });
  for (const material of [flatMaterial, ownNormalsMaterial]) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.undergrowthFocus = focusUniform;
      shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nuniform vec2 undergrowthFocus;").replace(
        "#include <begin_vertex>",
        [
          "#include <begin_vertex>",
          "#ifdef USE_INSTANCING",
          // Shrink each plant towards its foot as it nears the edge of the drawn area.
          "vec2 undergrowthSpot = ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xz;",
          `transformed *= 1.0 - smoothstep( ${FADE_START_METRES.toFixed(1)}, ${UNDERGROWTH_DRAW_METRES.toFixed(1)}, distance( undergrowthSpot, undergrowthFocus ) );`,
          "#endif",
        ].join("\n"),
      );
    };
  }
  const materialFor = (shape: UndergrowthShape) => (shape.ownNormals === true ? ownNormalsMaterial : flatMaterial);

  // One batch per model. Batches grow when a view needs more plants than they hold.
  const batches = shapes.map((shape) => ({ shape, mesh: newBatch(shape.geometry, materialFor(shape), 64), count: 0 }));
  for (const batch of batches) group.add(batch.mesh);
  const batchesByKind = new Map<UndergrowthKind, typeof batches>();
  for (const kind of Object.keys(LOOK_BY_KIND) as UndergrowthKind[]) {
    batchesByKind.set(
      kind,
      batches.filter((batch) => LOOK_BY_KIND[kind].models.test(batch.shape.name)),
    );
  }

  /** Patches grown so far, by column and row. Patches far from the focus are dropped. */
  const grown = new Map<number, UndergrowthItem[]>();
  let drawnPatch: number | undefined;
  /** What the player had placed when the undergrowth was last drawn. */
  let footprints: CampFootprint[] = [];
  const matrix = new THREE.Matrix4();
  const turn = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();

  /** Grows the patches around the focus's patch and fills the batches with their plants. */
  function drawAround(column: number, row: number): void {
    // A plant within the draw distance of any spot in the focus's patch lies in a patch this many patches away, or nearer.
    const reach = Math.ceil(UNDERGROWTH_DRAW_METRES / UNDERGROWTH_PATCH_METRES) + 1;
    const near = new Map<number, UndergrowthItem[]>();
    for (let r = Math.max(0, row - reach); r <= Math.min(patchesPerSide - 1, row + reach); r += 1) {
      for (let c = Math.max(0, column - reach); c <= Math.min(patchesPerSide - 1, column + reach); c += 1) {
        if (Math.hypot(c - column, r - row) > reach) continue;
        const key = r * patchesPerSide + c;
        near.set(key, grown.get(key) ?? growUndergrowthPatch(valley.seed, groundMap, c, r));
      }
    }
    grown.clear();
    for (const [key, plants] of near) grown.set(key, plants);

    for (const batch of batches) batch.count = 0;
    for (const plants of near.values()) {
      for (const plant of plants) addPlant(plant);
    }
    for (const batch of batches) {
      batch.mesh.count = batch.count;
      batch.mesh.instanceMatrix.needsUpdate = true;
      batch.mesh.computeBoundingSphere();
    }
  }

  /** Adds one plant to its model's batch, unless it lies under something the player has placed. */
  function addPlant(plant: UndergrowthItem): void {
    const choices = batchesByKind.get(plant.kind) ?? [];
    const batch = choices[Math.min(choices.length - 1, Math.floor(plant.look * choices.length))];
    if (batch === undefined || isUnderCamp(footprints, plant.x, plant.z)) return;
    if (batch.count === batch.mesh.instanceMatrix.count) {
      const bigger = newBatch(batch.shape.geometry, materialFor(batch.shape), batch.mesh.instanceMatrix.count * 2);
      bigger.instanceMatrix.array.set(batch.mesh.instanceMatrix.array);
      group.remove(batch.mesh);
      batch.mesh.dispose();
      batch.mesh = bigger;
      group.add(bigger);
    }
    const size = plant.size * LOOK_BY_KIND[plant.kind].size;
    position.set(plant.x, terrainHeightAt(valley.terrain, plant.x, plant.z), plant.z);
    matrix.compose(position, turn.setFromAxisAngle(up, plant.turn), scale.set(size, size, size));
    batch.mesh.setMatrixAt(batch.count, matrix);
    batch.count += 1;
  }

  return {
    group,
    update(focus) {
      focusUniform.value.set(focus.x, focus.z);
      const half = valley.size / 2;
      const column = Math.floor((focus.x + half) / UNDERGROWTH_PATCH_METRES);
      const row = Math.floor((focus.z + half) / UNDERGROWTH_PATCH_METRES);
      const patch = row * patchesPerSide + column;
      const nowFootprints = campFootprints(entities);
      if (patch === drawnPatch && sameFootprints(nowFootprints, footprints)) return;
      drawnPatch = patch;
      footprints = nowFootprints;
      drawAround(column, row);
    },
    dispose() {
      for (const batch of batches) batch.mesh.dispose();
      flatMaterial.dispose();
      ownNormalsMaterial.dispose();
    },
  };
}

/** A batch that draws one model up to `capacity` times. It is never picked and casts no shadow. */
function newBatch(geometry: THREE.BufferGeometry, material: THREE.Material, capacity: number): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.receiveShadow = true;
  // Clicks never land on undergrowth.
  mesh.raycast = () => undefined;
  return mesh;
}
