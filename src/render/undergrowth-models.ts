// Loads the shapes of the "grass", "ferns", "flowers", and "pebbles" assets in asset-manifest.json (all drafts).
// Each file packs several of Kenney's Nature Kit models (CC0), unchanged. The files' colours are replaced in code
// with the game's own, so the undergrowth matches the ground. undergrowth-meshes.ts draws the shapes.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** The four undergrowth assets, each one file in public/assets/<id>/<id>.glb. */
export type UndergrowthAsset = "grass" | "ferns" | "flowers" | "pebbles";
export const UNDERGROWTH_ASSETS: readonly UndergrowthAsset[] = ["grass", "ferns", "flowers", "pebbles"];

/** How many metres one model unit is. A grass tuft then stands about 0.4 m tall. */
const METRES_PER_MODEL_UNIT = 1.6;

/** The game's colour for each of Kenney's material names. A name not listed keeps a plain stone grey. */
const COLOUR_BY_MATERIAL: Readonly<Record<string, number>> = {
  grass: 0x5d8a34,
  leafsGreen: 0x3f6b2a,
  dirt: 0x6e6658,
  stone: 0x8a8780,
  colorRed: 0xc2453b,
  colorPurple: 0x8a5cc2,
  colorYellow: 0xe0c040,
  colorWhite: 0xeee8d8,
};
const OTHER_COLOUR = 0x8a8780;

/**
 * One undergrowth model in metres, with the pivot at the middle of its foot on the ground.
 * Each corner has a vertex colour in the game's colours.
 */
export interface UndergrowthShape {
  /** The model's name in its file, such as "grass_large". */
  readonly name: string;
  /** The asset whose file holds the model. */
  readonly asset: UndergrowthAsset;
  readonly geometry: THREE.BufferGeometry;
}

/** Loads every model in the four undergrowth files. */
export async function loadUndergrowthShapes(): Promise<UndergrowthShape[]> {
  const loader = new GLTFLoader();
  const files = await Promise.all(
    UNDERGROWTH_ASSETS.map((id) => loader.loadAsync(`${import.meta.env.BASE_URL}assets/${id}/${id}.glb`)),
  );
  return files.flatMap((gltf, index) => {
    const asset = UNDERGROWTH_ASSETS[index] ?? "grass";
    gltf.scene.updateMatrixWorld(true);
    return gltf.scene.children.map((root) => readShape(root, asset));
  });
}

/** Reads one model: every mesh under the root, merged into one geometry with vertex colours. */
function readShape(root: THREE.Object3D, asset: UndergrowthAsset): UndergrowthShape {
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const parts: THREE.BufferGeometry[] = [];
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = (object.geometry as THREE.BufferGeometry)
      .clone()
      .applyMatrix4(new THREE.Matrix4().multiplyMatrices(rootInverse, object.matrixWorld));
    // Keep only positions and normals, so the parts merge. Each part gets its colour as a vertex colour.
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== "position" && name !== "normal") geometry.deleteAttribute(name);
    }
    const loose = geometry.index === null ? geometry : geometry.toNonIndexed();
    if (loose !== geometry) geometry.dispose();
    const material = object.material as THREE.Material;
    const colour = new THREE.Color(COLOUR_BY_MATERIAL[material.name] ?? OTHER_COLOUR);
    const count = loose.getAttribute("position").count;
    const colours = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) colour.toArray(colours, i * 3);
    loose.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    parts.push(loose);
  });
  if (parts.length === 0) throw new Error(`${root.name} holds no mesh`);
  const geometry = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  standOnGround(geometry);
  return { name: root.name, asset, geometry };
}

/** Scales a model to metres and stands its foot's middle on y = 0. */
function standOnGround(geometry: THREE.BufferGeometry): void {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox ?? new THREE.Box3();
  const middle = box.getCenter(new THREE.Vector3());
  geometry.translate(-middle.x, -box.min.y, -middle.z);
  geometry.scale(METRES_PER_MODEL_UNIT, METRES_PER_MODEL_UNIT, METRES_PER_MODEL_UNIT);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}
