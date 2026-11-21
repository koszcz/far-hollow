// Loads the shapes of the "trees" asset in asset-manifest.json: trees.glb, eight of Kenney's Nature Kit trees (CC0)
// packed into one file. The owner approved the asset. forest-meshes.ts draws the shapes in the game's colours.
// It also loads the approved "saplings" asset's saplings.glb, laid out the same way, for sapling-shape.ts.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const TREE_MODEL_PATH = "assets/trees/trees.glb";
/** How many metres one model unit is. Every type shares it, so a tall pine stays taller than an oak. */
const METRES_PER_MODEL_UNIT = 5.5;

/** Which of the game's colours a part is drawn in. Kenney's material names say whether a part is the dark kind. */
export type TreeTone = "dark" | "light";

/** One type of tree, in metres, with the pivot at the foot of the trunk. */
export interface TreeShape {
  /** The model's name in trees.glb, such as "tree_oak". */
  readonly name: string;
  readonly trunk: THREE.BufferGeometry;
  readonly crown: THREE.BufferGeometry;
  readonly trunkTone: TreeTone;
  readonly crownTone: TreeTone;
}

/** Loads every tree type in trees.glb. Each top-level node is one type, with one wood part and one leaf part. */
export function loadTreeShapes(): Promise<TreeShape[]> {
  return loadTreeShapesFrom(TREE_MODEL_PATH);
}

/**
 * Loads every tree in a file laid out like trees.glb, such as the saplings in saplings.glb.
 * `path` is from the public folder. The shapes use the same metres per model unit as the trees.
 */
export async function loadTreeShapesFrom(path: string): Promise<TreeShape[]> {
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}${path}`);
  gltf.scene.updateMatrixWorld(true);
  const shapes = gltf.scene.children.map((root) => readShape(root, path));
  if (shapes.length === 0) throw new Error(`${path} holds no trees`);
  return shapes;
}

function readShape(root: THREE.Object3D, path: string): TreeShape {
  const trunks: { geometry: THREE.BufferGeometry; tone: TreeTone }[] = [];
  const crowns: { geometry: THREE.BufferGeometry; tone: TreeTone }[] = [];
  // Place each type at the origin, whatever its spot in the file.
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const material = object.material as THREE.Material;
    const geometry = (object.geometry as THREE.BufferGeometry)
      .clone()
      .applyMatrix4(new THREE.Matrix4().multiplyMatrices(rootInverse, object.matrixWorld))
      .scale(METRES_PER_MODEL_UNIT, METRES_PER_MODEL_UNIT, METRES_PER_MODEL_UNIT);
    geometry.computeBoundingSphere();
    const tone: TreeTone = material.name.includes("Dark") ? "dark" : "light";
    if (material.name.startsWith("wood")) trunks.push({ geometry, tone });
    else if (material.name.startsWith("leaf")) crowns.push({ geometry, tone });
    else geometry.dispose();
  });
  const [trunk] = trunks;
  const [crown] = crowns;
  if (trunk === undefined || crown === undefined || trunks.length > 1 || crowns.length > 1) {
    throw new Error(`${root.name} in ${path} must hold exactly one wood part and one leaf part`);
  }
  return { name: root.name, trunk: trunk.geometry, crown: crown.geometry, trunkTone: trunk.tone, crownTone: crown.tone };
}
