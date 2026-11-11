// Loads the shape of the "mushrooms" asset in asset-manifest.json: mushrooms.glb, Kenney's Nature Kit
// mushroom_tanGroup (CC0), the same kit as the trees and the berry bush. The owner approved the asset.
// The file's colours are replaced in code: brown caps and cream stems.
// forage-meshes.ts draws a patch of these mushrooms, and nothing while a foraged patch grows back.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const MUSHROOMS_MODEL_PATH = "assets/mushrooms/mushrooms.glb";
/** The patch is scaled so it is this wide across the ground, in metres. It then stands about 0.33 m tall. */
const PATCH_WIDTH_METRES = 0.35;
/** The file's tan cap material, by name. Every other part of the file is a stem. */
const CAP_MATERIAL_NAME = "colorTan";
const CAP_COLOUR = new THREE.Color(0x7a4426);
const STEM_COLOUR = new THREE.Color(0xe8dcc0);

/**
 * The mushroom patch in metres, with the pivot at the middle of its foot on the ground.
 * Each corner has a vertex colour: brown for the caps and cream for the stems.
 */
export type MushroomsShape = THREE.BufferGeometry;

export async function loadMushroomsShape(): Promise<MushroomsShape> {
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}${MUSHROOMS_MODEL_PATH}`);
  gltf.scene.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  gltf.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = (object.geometry as THREE.BufferGeometry).clone().applyMatrix4(object.matrixWorld);
    // Keep only positions and normals, so the parts merge. Each part gets its colour as a vertex colour.
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== "position" && name !== "normal") geometry.deleteAttribute(name);
    }
    const loose = geometry.index === null ? geometry : geometry.toNonIndexed();
    if (loose !== geometry) geometry.dispose();
    const material = object.material as THREE.MeshStandardMaterial;
    const count = loose.getAttribute("position").count;
    const colours = new Float32Array(count * 3);
    const colour = material.name === CAP_MATERIAL_NAME ? CAP_COLOUR : STEM_COLOUR;
    for (let i = 0; i < count; i += 1) colour.toArray(colours, i * 3);
    loose.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    parts.push(loose);
  });
  if (parts.length === 0) throw new Error(`${MUSHROOMS_MODEL_PATH} holds no mesh`);
  const patch = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  fitToGround(patch);
  return patch;
}

/** Scales the patch to its width in metres and stands its foot's middle on y = 0. */
function fitToGround(geometry: THREE.BufferGeometry): void {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox ?? new THREE.Box3();
  const width = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
  const middle = box.getCenter(new THREE.Vector3());
  geometry.translate(-middle.x, -box.min.y, -middle.z);
  geometry.scale(PATCH_WIDTH_METRES / width, PATCH_WIDTH_METRES / width, PATCH_WIDTH_METRES / width);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}
