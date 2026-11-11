// Loads the shape of the "stumps" asset in asset-manifest.json: stumps.glb, Kenney's Nature Kit
// stump_roundDetailed (CC0), the same kit as the trees. forest-meshes.ts fits it to each felled tree's trunk.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const STUMP_MODEL_PATH = "assets/stumps/stumps.glb";
/** Only points this close to the bottom of the model count when measuring how wide the stump's foot is, in model units. */
const FOOT_BAND_MODEL_UNITS = 0.08;

/**
 * The stump in model units, with the pivot at the foot's middle on the ground.
 * Its bottom sits a little below y = 0, so a stump on a slope does not float.
 * Group 0 is the bark and group 1 is the cut face, so it draws with a material for each.
 */
export interface StumpShape {
  readonly geometry: THREE.BufferGeometry;
  /** How far the foot reaches from the pivot, in model units, so the stump can be fitted to a trunk. */
  readonly footRadius: number;
  /** How tall the stump stands above y = 0, in model units. */
  readonly height: number;
}

export async function loadStumpShape(): Promise<StumpShape> {
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}${STUMP_MODEL_PATH}`);
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
  if (bark.length === 0 || cut.length === 0) throw new Error(`${STUMP_MODEL_PATH} must hold a woodBark part and a woodInner part`);
  const barkPart = mergeGeometries(bark);
  const cutPart = mergeGeometries(cut);
  const geometry = mergeGeometries([barkPart, cutPart], true);
  for (const part of [...bark, ...cut, barkPart, cutPart]) part.dispose();
  geometry.computeBoundingBox();
  const box = geometry.boundingBox ?? new THREE.Box3();
  return { geometry, footRadius: footRadiusOf(geometry, box.min.y), height: box.max.y };
}

/** A copy of one index range of a geometry, as its own non-indexed geometry. */
function partOf(source: THREE.BufferGeometry, start: number, count: number): THREE.BufferGeometry {
  const flat = source.index === null ? source.clone() : source.toNonIndexed();
  const part = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(flat.attributes)) {
    const size = attribute.itemSize;
    part.setAttribute(name, new THREE.BufferAttribute(attribute.array.slice(start * size, (start + count) * size), size));
  }
  flat.dispose();
  return part;
}

/** How far the stump's foot reaches from the pivot across the ground, ignoring the knot higher up the side. */
function footRadiusOf(geometry: THREE.BufferGeometry, bottom: number): number {
  const position = geometry.getAttribute("position");
  let radius = 0;
  for (let i = 0; i < position.count; i += 1) {
    if (position.getY(i) - bottom > FOOT_BAND_MODEL_UNITS) continue;
    radius = Math.max(radius, Math.hypot(position.getX(i), position.getZ(i)));
  }
  return radius;
}
