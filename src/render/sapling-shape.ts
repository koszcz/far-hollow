// Builds the draft "saplings" asset in asset-manifest.json: a small sapling and a young tree for each tree type in "trees".
// Each is that type's own trunk and crown, shrunk in code: a young tree is about half the full height and thin,
// and a sapling is about a metre tall. forest-meshes.ts places them at each growing tree's spot, in the trees' colours.
import type * as THREE from "three";
import type { TreeShape } from "./tree-model";

/** How a stage is shrunk from the full tree: `across` for width and depth, `up` for height. */
interface StageScale {
  readonly across: number;
  readonly up: number;
}

const SAPLING_SCALE: StageScale = { across: 0.12, up: 0.15 };
const YOUNG_TREE_SCALE: StageScale = { across: 0.35, up: 0.5 };

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

export function createSaplingShapes(tree: Pick<TreeShape, "trunk" | "crown">): SaplingShapes {
  return { sapling: shrink(tree, SAPLING_SCALE), youngTree: shrink(tree, YOUNG_TREE_SCALE) };
}

function shrink(tree: Pick<TreeShape, "trunk" | "crown">, { across, up }: StageScale): GrowingShape {
  const scaled = (geometry: THREE.BufferGeometry) => {
    const copy = geometry.clone().scale(across, up, across);
    copy.computeBoundingSphere();
    return copy;
  };
  return { trunk: scaled(tree.trunk), crown: scaled(tree.crown) };
}
