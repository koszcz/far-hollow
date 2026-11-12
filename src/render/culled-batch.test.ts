import { describe, expect, it } from "bun:test";
import * as THREE from "three";
import { createCulledBatch, frustumOf, SHADOW_ONLY_LAYER } from "./culled-batch";

const box = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshBasicMaterial();
const at = (x: number, z: number) => new THREE.Matrix4().makeTranslation(x, 0, z);

/** A camera at the origin, looking down -z, that sees out to 100 m. */
function lookingNorth(): THREE.Frustum {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  return frustumOf(camera, new THREE.Frustum());
}

/** A shadow box 10 m wide around the spot (x, z), looking straight down. */
function shadowBoxAround(x: number, z: number): THREE.Frustum {
  const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 1, 100);
  camera.position.set(x, 50, z);
  camera.lookAt(x, 0, z);
  return frustumOf(camera, new THREE.Frustum());
}

function batchWithTrees(): ReturnType<typeof createCulledBatch> {
  const batch = createCulledBatch([{ geometry: box, material }], 4, true);
  batch.set(0, at(0, -20)); // In front of the camera.
  batch.set(1, at(0, 20)); // Behind the camera.
  batch.set(2, at(0, -200)); // Beyond the camera's far edge.
  batch.set(3, at(3, 22)); // Behind the camera, near instance 1.
  return batch;
}

describe("createCulledBatch", () => {
  it("draws every instance until it is first culled", () => {
    const batch = batchWithTrees();
    batch.cull();
    expect(batch.meshes.map((mesh) => mesh.count)).toEqual([4, 4]);
  });

  it("draws only the instances the camera sees in the main pass", () => {
    const batch = batchWithTrees();
    batch.cull({ view: lookingNorth(), shadow: null });
    const [view] = batch.viewMeshes;
    expect(view?.count).toBe(1);
    expect(batch.instanceHit(0)).toBe(0);
  });

  it("draws only the instances inside the shadow box in the shadow pass, on the shadow-only layer", () => {
    const batch = batchWithTrees();
    batch.cull({ view: lookingNorth(), shadow: shadowBoxAround(0, 20) });
    const shadow = batch.meshes.find((mesh) => !batch.viewMeshes.includes(mesh));
    expect(shadow?.count).toBe(2);
    expect(shadow?.layers.mask).toBe(1 << SHADOW_ONLY_LAYER);
    expect(shadow?.castShadow).toBe(true);
    expect(batch.viewMeshes[0]?.castShadow).toBe(false);
  });

  it("draws nothing in the shadow pass while the sun casts no shadows", () => {
    const batch = batchWithTrees();
    batch.cull({ view: lookingNorth(), shadow: null });
    const shadow = batch.meshes.find((mesh) => !batch.viewMeshes.includes(mesh));
    expect(shadow?.count).toBe(0);
  });

  it("stops drawing a hidden instance and keeps the others where they were placed", () => {
    const batch = batchWithTrees();
    batch.set(1, undefined);
    batch.cull();
    expect(batch.viewMeshes[0]?.count).toBe(3);
    const placed = new THREE.Matrix4();
    expect(batch.matrixAt(1, placed)).toBe(false);
    expect(batch.matrixAt(3, placed)).toBe(true);
    expect(new THREE.Vector3().setFromMatrixPosition(placed)).toEqual(new THREE.Vector3(3, 0, 22));
  });

  it("maps a ray hit on a drawn instance back to the instance", () => {
    const batch = batchWithTrees();
    batch.cull({ view: lookingNorth(), shadow: null });
    const [view] = batch.viewMeshes;
    if (view === undefined) throw new Error("The batch has no main pass mesh.");
    view.updateMatrixWorld();
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));
    const hitId = ray.intersectObject(view, false)[0]?.instanceId;
    expect(hitId).toBeDefined();
    expect(hitId === undefined ? undefined : batch.instanceHit(hitId)).toBe(0);
  });
});
