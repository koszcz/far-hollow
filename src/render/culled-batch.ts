// A batch of instanced shapes that draws only the instances a camera can see.
// - The main pass and the sun's shadow pass each get their own copy of the batch, culled for their own camera.
// - The shadow copy sits on SHADOW_ONLY_LAYER, which only the sun's shadow camera sees.
// - Until cull is first called, both copies draw every instance.
import * as THREE from "three";

/** Objects on this layer are drawn only into the sun's shadows, never on screen. */
export const SHADOW_ONLY_LAYER = 1;

/** The cameras to cull for this frame. `shadow` is null while the sun casts no shadows. */
export interface CullViews {
  readonly view: THREE.Frustum;
  readonly shadow: THREE.Frustum | null;
}

/** One shape in the batch. Every instance draws all its parts with the same matrix, such as a trunk and its crown. */
export interface CulledBatchPart {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material | THREE.Material[];
}

export interface CulledBatch {
  /** The meshes to add to the scene: one per part for the main pass, and one per part for the shadow pass. */
  readonly meshes: readonly THREE.InstancedMesh[];
  /** The main pass meshes, in part order. Rays for clicks test these. */
  readonly viewMeshes: readonly THREE.InstancedMesh[];
  /** Places instance `index`, or hides it when `matrix` is undefined. */
  set(index: number, matrix: THREE.Matrix4 | undefined): void;
  /** Copies instance `index`'s matrix into `out`. Returns false when the instance is hidden. */
  matrixAt(index: number, out: THREE.Matrix4): boolean;
  /** The instance that a ray hit on one of `viewMeshes` landed on, from the hit's instance id. */
  instanceHit(drawnId: number): number | undefined;
  /** Draws only the instances inside each camera's view. Without views, it applies changes for the last views given. */
  cull(views?: CullViews): void;
  dispose(): void;
}

/**
 * capacity is the most instances the batch holds. Every instance starts hidden.
 * castShadow says whether the batch has a shadow copy at all.
 */
export function createCulledBatch(parts: readonly CulledBatchPart[], capacity: number, castShadow: boolean): CulledBatch {
  const viewMeshes = parts.map((part) => newMesh(part, capacity));
  for (const mesh of viewMeshes) {
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    // Sky lighting marks solid meshes as shadow casters. The shadow copy casts for this one.
    mesh.userData.castsShadowSeparately = true;
  }
  const shadowMeshes = castShadow ? parts.map((part) => newMesh(part, capacity)) : [];
  for (const mesh of shadowMeshes) {
    mesh.layers.set(SHADOW_ONLY_LAYER);
    mesh.castShadow = true;
  }

  // An instance's bounding sphere is this sphere, around all its parts, placed with its matrix.
  const box = new THREE.Box3();
  for (const part of parts) {
    part.geometry.computeBoundingBox();
    if (part.geometry.boundingBox !== null) box.union(part.geometry.boundingBox);
  }
  const localSphere = box.isEmpty() ? new THREE.Sphere() : box.getBoundingSphere(new THREE.Sphere());

  const matrices = new Float32Array(capacity * 16);
  const shown = new Uint8Array(capacity);
  const spheres = Array.from({ length: capacity }, () => new THREE.Sphere());
  let views: CullViews | undefined;
  let dirty = true;
  /** The instances each copy draws now, in drawn order. */
  let viewDrawn: number[] = [];
  let shadowDrawn: number[] = [];
  function drawnIn(frustum: THREE.Frustum | null | undefined): number[] {
    const drawn: number[] = [];
    if (frustum === null) return drawn;
    for (let index = 0; index < capacity; index += 1) {
      const sphere = spheres[index];
      if (shown[index] === 1 && sphere !== undefined && (frustum === undefined || frustum.intersectsSphere(sphere))) drawn.push(index);
    }
    return drawn;
  }

  function fill(meshes: readonly THREE.InstancedMesh[], drawn: readonly number[]): void {
    for (const mesh of meshes) {
      const array = mesh.instanceMatrix.array as Float32Array;
      drawn.forEach((index, slot) => {
        array.set(matrices.subarray(index * 16, index * 16 + 16), slot * 16);
      });
      mesh.count = drawn.length;
      mesh.instanceMatrix.needsUpdate = true;
      // Rays test this sphere first, so it is worked out again from the instances drawn now.
      mesh.boundingSphere = null;
    }
  }

  function cull(next?: CullViews): void {
    if (next !== undefined) views = next;
    else if (!dirty) return;
    const nextView = drawnIn(views?.view);
    if (dirty || !sameList(nextView, viewDrawn)) fill(viewMeshes, nextView);
    viewDrawn = nextView;
    if (castShadow) {
      const nextShadow = drawnIn(views === undefined ? undefined : views.shadow);
      if (dirty || !sameList(nextShadow, shadowDrawn)) fill(shadowMeshes, nextShadow);
      shadowDrawn = nextShadow;
    }
    dirty = false;
  }

  return {
    meshes: [...viewMeshes, ...shadowMeshes],
    viewMeshes,
    set(index, placed) {
      if (index < 0 || index >= capacity) return;
      dirty = true;
      if (placed === undefined) {
        shown[index] = 0;
        return;
      }
      shown[index] = 1;
      placed.toArray(matrices, index * 16);
      spheres[index]?.copy(localSphere).applyMatrix4(placed);
    },
    matrixAt(index, out) {
      if (index < 0 || index >= capacity || shown[index] !== 1) return false;
      out.fromArray(matrices, index * 16);
      return true;
    },
    instanceHit(drawnId) {
      cull();
      return viewDrawn[drawnId];
    },
    cull,
    dispose() {
      for (const mesh of [...viewMeshes, ...shadowMeshes]) mesh.dispose();
    },
  };
}

function newMesh(part: CulledBatchPart, capacity: number): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(part.geometry, part.material, Math.max(1, capacity));
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  // The batch culls its own instances, so the mesh as a whole is never culled.
  mesh.frustumCulled = false;
  return mesh;
}

function sameList(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/** The frustum a camera sees now. Call it after the camera last moves this frame. */
export function frustumOf(camera: THREE.Camera, out: THREE.Frustum): THREE.Frustum {
  camera.updateMatrixWorld();
  frustumMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  return out.setFromProjectionMatrix(frustumMatrix);
}
const frustumMatrix = new THREE.Matrix4();
