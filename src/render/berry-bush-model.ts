// Loads the shape of the "berry-bush" asset in asset-manifest.json: berry-bush.glb, Kenney's Nature Kit
// plant_bushDetailed (CC0), the same kit as the trees. The owner approved the asset.
// The berries are built in code and sit on the bush's leaves.
// forage-meshes.ts draws the bush with berries, and without them while it grows back after foraging.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const BERRY_BUSH_MODEL_PATH = "assets/berry-bush/berry-bush.glb";
/** The bush is scaled so it is this wide across the ground, in metres. It then stands about 0.7 m tall. */
const BUSH_WIDTH_METRES = 1.4;
const BERRY_RADIUS_METRES = 0.045;
/** How far apart the berries in one cluster sit, from the cluster's middle, in metres. */
const CLUSTER_SPREAD_METRES = 0.05;
const CLUSTER_COUNT = 9;

/** The berry bush in metres, with the pivot at the middle of its foot on the ground. */
export interface BerryBushShape {
  readonly bush: THREE.BufferGeometry;
  /** Clusters of three berries, placed on the bush's surface. */
  readonly berries: THREE.BufferGeometry;
  /** How tall the bush stands, in metres. */
  readonly height: number;
}

export async function loadBerryBushShape(): Promise<BerryBushShape> {
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}${BERRY_BUSH_MODEL_PATH}`);
  gltf.scene.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  gltf.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = (object.geometry as THREE.BufferGeometry).clone().applyMatrix4(object.matrixWorld);
    // Keep only positions and normals, so the parts merge, and the bush draws in the game's own colour.
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== "position" && name !== "normal") geometry.deleteAttribute(name);
    }
    parts.push(geometry.index === null ? geometry : geometry.toNonIndexed());
  });
  if (parts.length === 0) throw new Error(`${BERRY_BUSH_MODEL_PATH} holds no mesh`);
  const bush = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  fitToGround(bush);
  bush.computeBoundingBox();
  const height = bush.boundingBox?.max.y ?? 0;
  return { bush, berries: createBerriesOn(bush, height), height };
}

/** Scales the bush to its width in metres and stands its foot's middle on y = 0. */
function fitToGround(geometry: THREE.BufferGeometry): void {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox ?? new THREE.Box3();
  const width = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
  const middle = box.getCenter(new THREE.Vector3());
  geometry.translate(-middle.x, -box.min.y, -middle.z);
  geometry.scale(BUSH_WIDTH_METRES / width, BUSH_WIDTH_METRES / width, BUSH_WIDTH_METRES / width);
}

/**
 * Clusters of three berries on the bush's surface. Each cluster is found by casting a ray at the bush from outside,
 * spread around and up its sides by a fixed pattern, so every bush has its berries in the same places.
 */
function createBerriesOn(bush: THREE.BufferGeometry, height: number): THREE.BufferGeometry {
  const target = new THREE.Mesh(bush, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const raycaster = new THREE.Raycaster();
  const middle = new THREE.Vector3();
  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const berries: THREE.BufferGeometry[] = [];
  for (let i = 0; i < CLUSTER_COUNT; i += 1) {
    const around = i * 2.4;
    // Aim at the bush's stem, from a quarter to three quarters of its height, so berries hang among the outer leaves.
    middle.set(0, height * (0.25 + ((i * 0.37) % 1) * 0.5), 0);
    origin.set(Math.sin(around) * 3, middle.y + 0.6, Math.cos(around) * 3);
    direction.subVectors(middle, origin).normalize();
    raycaster.set(origin, direction);
    const hit = raycaster.intersectObject(target, false)[0];
    if (hit?.face == null) continue;
    const normal = hit.face.normal.clone();
    // Faces seen from inside would push berries into the bush, so turn the normal to face the ray.
    if (normal.dot(direction) > 0) normal.negate();
    const across = new THREE.Vector3().crossVectors(normal, up);
    if (across.lengthSq() < 1e-6) across.set(1, 0, 0);
    across.normalize();
    const along = new THREE.Vector3().crossVectors(across, normal).normalize();
    for (let berry = 0; berry < 3; berry += 1) {
      const turn = around + (berry * Math.PI * 2) / 3;
      const place = hit.point
        .clone()
        .addScaledVector(normal, BERRY_RADIUS_METRES * 0.6)
        .addScaledVector(across, Math.cos(turn) * CLUSTER_SPREAD_METRES)
        .addScaledVector(along, Math.sin(turn) * CLUSTER_SPREAD_METRES);
      const geometry = new THREE.IcosahedronGeometry(BERRY_RADIUS_METRES, 1);
      geometry.deleteAttribute("uv");
      berries.push(geometry.translate(place.x, place.y, place.z));
    }
  }
  (target.material as THREE.Material).dispose();
  const merged = mergeGeometries(berries.map((part) => (part.index === null ? part : part.toNonIndexed())));
  for (const part of berries) part.dispose();
  merged.computeVertexNormals();
  return merged;
}
