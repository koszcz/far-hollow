// Builds the "saplings" asset in asset-manifest.json (approved): a sapling and a young tree for each tree type in "trees".
// - The sapling is a Kenney Nature Kit small tree (CC0) from saplings.glb: tree_pineSmallA for pine types and
//   tree_small for the other types. It is scaled to about a metre tall, a share of its tree type's full height.
// - The young tree is the type's own trunk and crown, shrunk in code to about half the full height, and thin.
// forest-meshes.ts places both at each growing tree's spot, in the tree type's colours.
import * as THREE from "three";
import { loadTreeShapesFrom, type TreeShape } from "./tree-model";

const SAPLING_MODEL_PATH = "assets/saplings/saplings.glb";
/** The sapling's height as a share of its tree type's full height, before the tree's own size is applied. */
const SAPLING_HEIGHT_SHARE = 0.15;
/** How the young tree is shrunk from the full tree: `across` for width and depth, `up` for height. */
const YOUNG_TREE_SCALE = { across: 0.35, up: 0.5 } as const;

/** The two sapling models in saplings.glb. */
export interface SaplingModels {
  /** Kenney's tree_pineSmallA, for pine types. */
  readonly pine: TreeShape;
  /** Kenney's tree_small, for every other type. */
  readonly leafy: TreeShape;
}

/** One stage's shape, in metres, with the pivot at the foot of the trunk, as for a full tree before its size is applied. */
export interface GrowingShape {
  readonly trunk: THREE.BufferGeometry;
  readonly crown: THREE.BufferGeometry;
}

/** The sapling and the young tree of one tree type. */
export interface SaplingShapes {
  readonly sapling: GrowingShape;
  readonly youngTree: GrowingShape;
}

export async function loadSaplingModels(): Promise<SaplingModels> {
  const shapes = await loadTreeShapesFrom(SAPLING_MODEL_PATH);
  const pine = shapes.find((shape) => shape.name === "tree_pineSmallA");
  const leafy = shapes.find((shape) => shape.name === "tree_small");
  if (pine === undefined || leafy === undefined) throw new Error(`${SAPLING_MODEL_PATH} must hold tree_pineSmallA and tree_small`);
  return { pine, leafy };
}

export function createSaplingShapes(tree: Pick<TreeShape, "name" | "trunk" | "crown">, models: SaplingModels): SaplingShapes {
  const model = tree.name.includes("pine") ? models.pine : models.leafy;
  const size = (SAPLING_HEIGHT_SHARE * heightOf(tree)) / heightOf(model);
  return {
    sapling: scaled(model, size, size),
    youngTree: scaled(tree, YOUNG_TREE_SCALE.across, YOUNG_TREE_SCALE.up),
  };
}

function scaled(shape: Pick<TreeShape, "trunk" | "crown">, across: number, up: number): GrowingShape {
  const copy = (geometry: THREE.BufferGeometry) => {
    const result = geometry.clone().scale(across, up, across);
    result.computeBoundingSphere();
    return result;
  };
  return { trunk: copy(shape.trunk), crown: copy(shape.crown) };
}

/** How tall a tree stands above its pivot. */
function heightOf(shape: Pick<TreeShape, "trunk" | "crown">): number {
  const box = new THREE.Box3();
  for (const geometry of [shape.trunk, shape.crown]) {
    geometry.computeBoundingBox();
    if (geometry.boundingBox !== null) box.union(geometry.boundingBox);
  }
  return box.max.y;
}
