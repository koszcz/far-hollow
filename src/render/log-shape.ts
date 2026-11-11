// Loads the shape of the "logs" asset in asset-manifest.json: logs.glb, Kenney's Nature Kit log (CC0), the same kit
// as the trees and stumps. The owner approved the asset. forest-meshes.ts draws it on the ground. player-mesh.ts draws it on the player's shoulder.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { partOf } from "./stump-model";

const LOG_MODEL_PATH = "assets/logs/logs.glb";

/** The bark colour. */
export const LOG_COLOUR = 0x7a5532;
/** The two cut ends show pale wood, the same colour as the tops of stumps. */
export const LOG_CUT_COLOUR = 0xc9a46a;
/** The model is stretched evenly to this length. */
export const LOG_LENGTH_METRES = 1;

/**
 * The log lying along the z axis, in metres, centred on the origin.
 * Group 0 is the bark and group 1 is the two cut ends, so it draws with a material for each.
 */
export interface LogShape {
  readonly geometry: THREE.BufferGeometry;
  /** How far the log's middle sits above the ground when it lies there. */
  readonly restHeight: number;
}

export async function loadLogShape(): Promise<LogShape> {
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}${LOG_MODEL_PATH}`);
  gltf.scene.updateMatrixWorld(true);
  const bark: THREE.BufferGeometry[] = [];
  const cut: THREE.BufferGeometry[] = [];
  gltf.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = (Array.isArray(object.material) ? object.material : [object.material]) as THREE.Material[];
    const source = object.geometry as THREE.BufferGeometry;
    // Kenney stores both parts in one mesh, one group per material. Split them so each part has one material.
    const groups = source.groups.length > 0 ? source.groups : [{ start: 0, count: source.index?.count ?? 0, materialIndex: 0 }];
    for (const group of groups) {
      const name = materials[group.materialIndex ?? 0]?.name ?? "";
      const part = partOf(source, group.start, group.count).applyMatrix4(object.matrixWorld);
      if (name === "woodBark") bark.push(part);
      else if (name === "woodInner") cut.push(part);
      else part.dispose();
    }
  });
  if (bark.length === 0 || cut.length === 0) throw new Error(`${LOG_MODEL_PATH} must hold a woodBark part and a woodInner part`);
  const barkPart = mergeGeometries(bark);
  const cutPart = mergeGeometries(cut);
  const geometry = mergeGeometries([barkPart, cutPart], true);
  for (const part of [...bark, ...cut, barkPart, cutPart]) part.dispose();

  // Kenney's log already lies along z. Centre it on the origin and stretch it to the game's log length.
  geometry.computeBoundingBox();
  const box = geometry.boundingBox ?? new THREE.Box3();
  const centre = box.getCenter(new THREE.Vector3());
  geometry.translate(-centre.x, -centre.y, -centre.z);
  const scale = LOG_LENGTH_METRES / (box.max.z - box.min.z);
  geometry.scale(scale, scale, scale);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return { geometry, restHeight: -(geometry.boundingBox?.min.y ?? 0) };
}
