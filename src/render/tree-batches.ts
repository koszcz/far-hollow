// Builds the batches that draw the valley's trees: "trees", "far-trees", and "saplings" in asset-manifest.json (all approved).
// One culled batch per tree type, drawing its trunks and crowns, so thousands of trees take a few draw calls.
// Each batch draws only the trees the camera sees, and casts shadows only from the trees inside the sun's shadow box.
// Beyond FAR_TREE_METRES from the camera, a second batch per type draws each tree with its cheap far shape instead.
// Shadows always come from the real shape.
// Every tree spot gets a place in its type's batches: standing trees, and felled trees that grow back there.
// A growing tree draws as a sapling on its stump, then as a young tree, near and far like a full tree.
// Treetops, young trees, and saplings sway in the wind with wind-sway.ts. Trunks stay still.
import * as THREE from "three";
import { growingTreeEntities, stumpEntities, treeEntities, type Entity, type EntityStore } from "../sim/entities";
import type { GrowthStage } from "../sim/tree-growth";
import { isBroadleaf } from "./autumn-leaves";
import { createCulledBatch, type CulledBatch } from "./culled-batch";
import { createFarTreeShape, FAR_TREE_METRES } from "./tree-far-shape";
import { createSaplingShapes, type SaplingModels } from "./sapling-shape";
import { TREE_COLOURS, type TreeShape, type TreeTone } from "./tree-model";
import { addTreeSeeThrough, type TreeSeeThrough } from "./tree-see-through";
import { treeMatrix, treeTypeFor } from "./tree-placement";
import { CROWN_SNOW, type SnowCoverLook } from "./snow-cover-look";
import { SAPLING_SWAY, TREE_SWAY, YOUNG_TREE_SWAY, type SwayLook, type WindSway } from "./wind-sway";

/**
 * Each tree type's batches keep room for this many trees beyond the valley's own, for saplings the player plants.
 * A planted tree also takes the place of a tree whose entity is gone, such as a dug-up sapling.
 */
export const PLANTED_ROOM_PER_TYPE = 64;

/** The material a tree part is drawn with, in one of TREE_COLOURS. */
export function createTreeMaterial(colour: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: colour, flatShading: true });
}

/**
 * A tree's trunk and crown materials, one of each for each tone, for one growth stage.
 * Each broadleaf type has its own crown material, by type name, because each turns its own autumn colour.
 */
export interface TreeMaterials {
  readonly trunk: Readonly<Record<TreeTone, THREE.MeshStandardMaterial>>;
  readonly crown: Readonly<Record<TreeTone, THREE.MeshStandardMaterial>>;
  readonly broadleafCrown: ReadonlyMap<string, { readonly shape: TreeShape; readonly material: THREE.MeshStandardMaterial }>;
}

type TreePart = { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial };

/** Everything that draws one tree type: its full-grown batches, and the batches for its growing stages. */
export interface TreeTypeBatches {
  /** The full-grown tree, near. */
  readonly near: CulledBatch;
  /** The full-grown tree, near and far. */
  readonly batches: readonly CulledBatch[];
  readonly trunk: TreePart;
  readonly crown: TreePart;
  readonly youngNear: CulledBatch;
  readonly youngFar: CulledBatch;
  readonly young: { readonly trunk: TreePart; readonly crown: TreePart };
  readonly saplings: CulledBatch;
  /** The sapling's own shape, also drawn see-through where the player would plant one. */
  readonly sapling: { readonly trunk: THREE.BufferGeometry; readonly crown: THREE.BufferGeometry };
  /** The batches that show a tree at each growth stage. */
  readonly stageBatches: Readonly<Record<Exclude<GrowthStage, "stump">, readonly CulledBatch[]>>;
  readonly growingBatches: readonly CulledBatch[];
  /** How many trees the batches have room for. */
  readonly capacity: number;
}

export type ForestTree = Entity & { position: NonNullable<Entity["position"]> };

export interface TreeBatches {
  /** Every tree spot: standing trees, stumps, and growing trees. */
  readonly trees: ForestTree[];
  /** The tree type each tree is drawn as. */
  readonly typeOf: Map<Entity, number>;
  /** Each tree's place in its type's batches. */
  readonly instanceOf: Map<Entity, number>;
  /** The trees of each type, in batch order. */
  readonly treesOfType: ForestTree[][];
  /** The batch and trees behind each drawn mesh, so a click on a mesh can find its tree. */
  readonly treesOfMesh: Map<THREE.Object3D, { batch: CulledBatch; trees: ForestTree[] }>;
  /** One for each tree type. */
  readonly types: readonly TreeTypeBatches[];
  readonly trunkMaterials: Readonly<Record<TreeTone, THREE.MeshStandardMaterial>>;
  readonly allMaterials: readonly TreeMaterials[];
  readonly seeThrough: TreeSeeThrough;
  readonly allTreeBatches: readonly CulledBatch[];
  readonly treePickTargets: readonly THREE.Object3D[];
}

/**
 * `windSway` sways the treetops, young trees, and saplings. `snow`, if given, lays snow on the tops of their crowns, near and far.
 * `track` disposes what it is given when the forest is disposed. The batches are added to `group`.
 */
export function createTreeBatches(
  entities: EntityStore,
  shapes: { readonly trees: readonly TreeShape[]; readonly saplings: SaplingModels },
  windSway: WindSway,
  snow: SnowCoverLook | undefined,
  group: THREE.Group,
  track: <T extends { dispose(): void }>(item: T) => T,
): TreeBatches {
  const { trees: treeShapes, saplings: saplingModels } = shapes;
  const trees = [...new Set([...treeEntities(entities), ...stumpEntities(entities), ...growingTreeEntities(entities)])];
  /** One material for each tone of a tree part, swaying like `look`, or still with none. */
  const swayingMaterial = (colour: number, look?: SwayLook): THREE.MeshStandardMaterial => {
    const material = track(createTreeMaterial(colour));
    return look === undefined ? material : windSway.sway(material, look);
  };
  const toneMaterials = (part: "trunk" | "crown", look?: SwayLook): Record<TreeTone, THREE.MeshStandardMaterial> => ({
    dark: swayingMaterial(TREE_COLOURS[part].dark, look),
    light: swayingMaterial(TREE_COLOURS[part].light, look),
  });
  // Full trees sway only in their crowns. Young trees and saplings sway whole, each by their own height.
  // Each broadleaf type gets its own crown material, so it can turn its own autumn colour while the pines stay green.
  const treeMaterials = (trunkLook: SwayLook | undefined, crownLook: SwayLook): TreeMaterials => ({
    trunk: toneMaterials("trunk", trunkLook),
    crown: toneMaterials("crown", crownLook),
    broadleafCrown: new Map(
      treeShapes
        .filter((shape) => isBroadleaf(shape.name))
        .map((shape) => [shape.name, { shape, material: swayingMaterial(TREE_COLOURS.crown[shape.crownTone], crownLook) }]),
    ),
  });
  const fullMaterials = treeMaterials(undefined, TREE_SWAY);
  const youngMaterials = treeMaterials(YOUNG_TREE_SWAY, YOUNG_TREE_SWAY);
  const saplingMaterials = treeMaterials(SAPLING_SWAY, SAPLING_SWAY);
  const allMaterials = [fullMaterials, youngMaterials, saplingMaterials];
  const trunkMaterials = fullMaterials.trunk;
  /** The crown material for a tree type in this stage's materials: a broadleaf one, or a conifer one. */
  const crownOf = (materials: TreeMaterials, shape: TreeShape): THREE.MeshStandardMaterial =>
    materials.broadleafCrown.get(shape.name)?.material ?? materials.crown[shape.crownTone];
  const broadleafMaterialsOf = ({ broadleafCrown }: TreeMaterials) => [...broadleafCrown.values()].map(({ material }) => material);
  const seeThrough = addTreeSeeThrough(
    allMaterials.flatMap((materials) => [...Object.values(materials.trunk), ...Object.values(materials.crown), ...broadleafMaterialsOf(materials)]),
  );
  if (snow !== undefined) {
    for (const materials of allMaterials) {
      for (const material of [...Object.values(materials.crown), ...broadleafMaterialsOf(materials)]) snow.cover(material, CROWN_SNOW);
    }
  }
  for (const shape of treeShapes) {
    track(shape.trunk);
    track(shape.crown);
  }

  const typeOf = new Map<Entity, number>();
  const treesOfType: ForestTree[][] = treeShapes.map(() => []);
  for (const tree of trees) {
    const type = treeTypeFor(tree.position.x, tree.position.z, treeShapes);
    typeOf.set(tree, type);
    treesOfType[type]?.push(tree);
  }
  const matrix = new THREE.Matrix4();
  const instanceOf = new Map<Entity, number>();
  const treesOfMesh = new Map<THREE.Object3D, { batch: CulledBatch; trees: ForestTree[] }>();
  const types = treeShapes.map((shape, type): TreeTypeBatches => {
    const ofType = treesOfType[type] ?? [];
    const capacity = ofType.length + PLANTED_ROOM_PER_TYPE;
    const trunk = {
      geometry: shape.trunk,
      material: trunkMaterials[shape.trunkTone],
    };
    const crown = {
      geometry: shape.crown,
      material: crownOf(fullMaterials, shape),
    };
    const farShape = createFarTreeShape(shape);
    track(farShape.trunk);
    track(farShape.crown);
    const near = track(
      createCulledBatch([trunk, crown], capacity, true, {
        to: FAR_TREE_METRES,
      }),
    );
    const far = track(
      createCulledBatch(
        [
          { geometry: farShape.trunk, material: trunk.material },
          { geometry: farShape.crown, material: crown.material },
        ],
        capacity,
        false,
        { from: FAR_TREE_METRES },
      ),
    );
    const batches = [near, far];
    // A growing tree draws as a sapling on its stump, then as a young tree, near and far like a full tree.
    const growing = createSaplingShapes(shape, saplingModels);
    track(growing.sapling.trunk);
    track(growing.sapling.crown);
    track(growing.youngTree.trunk);
    track(growing.youngTree.crown);
    const youngFarShape = createFarTreeShape(growing.youngTree);
    track(youngFarShape.trunk);
    track(youngFarShape.crown);
    const young = {
      trunk: { geometry: growing.youngTree.trunk, material: youngMaterials.trunk[shape.trunkTone] },
      crown: { geometry: growing.youngTree.crown, material: crownOf(youngMaterials, shape) },
    };
    const youngNear = track(createCulledBatch([young.trunk, young.crown], capacity, true, { to: FAR_TREE_METRES }));
    const youngFar = track(
      createCulledBatch(
        [
          { geometry: youngFarShape.trunk, material: young.trunk.material },
          { geometry: youngFarShape.crown, material: young.crown.material },
        ],
        capacity,
        false,
        { from: FAR_TREE_METRES },
      ),
    );
    // Saplings are too small to see far away, or to cast much of a shadow.
    const saplings = track(
      createCulledBatch(
        [
          { geometry: growing.sapling.trunk, material: saplingMaterials.trunk[shape.trunkTone] },
          { geometry: growing.sapling.crown, material: crownOf(saplingMaterials, shape) },
        ],
        capacity,
        false,
        { to: FAR_TREE_METRES },
      ),
    );
    const stageBatches: Readonly<Record<Exclude<GrowthStage, "stump">, readonly CulledBatch[]>> = { sapling: [saplings], youngTree: [youngNear, youngFar] };
    ofType.forEach((tree, index) => {
      instanceOf.set(tree, index);
      if (tree.tree !== true) return;
      treeMatrix(tree.position, matrix);
      for (const batch of batches) batch.set(index, matrix);
    });
    for (const batch of [...batches, youngNear, youngFar, saplings]) {
      for (const mesh of batch.viewMeshes) treesOfMesh.set(mesh, { batch, trees: ofType });
    }
    for (const batch of [...batches, youngNear, youngFar, saplings]) {
      batch.cull();
      group.add(...batch.meshes);
    }
    const sapling = { trunk: growing.sapling.trunk, crown: growing.sapling.crown };
    return {
      near,
      batches,
      trunk,
      crown,
      youngNear,
      youngFar,
      young,
      saplings,
      sapling,
      stageBatches,
      growingBatches: [youngNear, youngFar, saplings],
      capacity,
    };
  });
  const allTreeBatches = types.flatMap(({ batches, growingBatches }) => [...batches, ...growingBatches]);
  const treePickTargets = types.flatMap(({ batches, youngNear, youngFar, saplings }) =>
    [...batches, youngNear, youngFar, saplings].flatMap((batch) => batch.viewMeshes),
  );

  return { trees, typeOf, instanceOf, treesOfType, treesOfMesh, types, trunkMaterials, allMaterials, seeThrough, allTreeBatches, treePickTargets };
}
