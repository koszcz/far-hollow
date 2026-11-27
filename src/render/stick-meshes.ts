// Draws the sticks lying on the ground: the "sticks" asset (approved) in asset-manifest.json, shaped by stick-shape.ts.
// One batch per stick shape, each with room for every stick the valley starts with.
// Taking down a structure can leave more sticks than that, so the batches grow when they run out of room.
import * as THREE from "three";
import { stickEntities, type Entity, type EntityStore } from "../sim/entities";
import type { OutlinePart } from "./hover-outline";
import { createGroundStickGeometry, GROUND_STICK_SHAPE_COUNT, STICK_COLOUR, STICK_LENGTH_METRES } from "./stick-shape";
import { lookFor } from "./tree-placement";

/** Sticks are thin, so clicks hit an invisible box this wide around each one, in metres. */
const STICK_PICK_WIDTH_METRES = 0.35;
/** Each stick's bark is up to this share lighter or darker than the others, so the floor does not look copy-pasted. */
const STICK_SHADE_SPREAD = 0.08;

export interface StickMeshes {
  /** The invisible boxes clicks are tested against. They are swapped when the batches grow, so ask each time. */
  pickers(): THREE.InstancedMesh;
  /** Redraws the sticks if one came or went since the last call. */
  update(): void;
  /** The stick drawn at a place in the pick boxes, if any. */
  stickAt(instanceId: number): Entity | undefined;
  /** The shape that draws `stick`, placed in the world. Empty once it is gone. */
  outlineOf(stick: Entity): OutlinePart[];
  dispose(): void;
}

/** `track` disposes what it is given when the forest is disposed. The sticks are added to `group`. */
export function createStickMeshes(entities: EntityStore, group: THREE.Group, track: <T extends { dispose(): void }>(item: T) => T): StickMeshes {
  const stickGeometries = Array.from({ length: GROUND_STICK_SHAPE_COUNT }, (_, shape) => track(createGroundStickGeometry(shape)));
  // Each shape's length along x, so its pick box is as long as the stick.
  const stickLengths = stickGeometries.map((geometry) => {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox ?? new THREE.Box3();
    return {
      length: box.max.x - box.min.x,
      middle: (box.max.x + box.min.x) / 2,
    };
  });
  // The stick geometry carries pale cut ends as vertex colours. Each stick also gets its own shade of bark.
  const stickMaterial = track(
    new THREE.MeshStandardMaterial({
      color: STICK_COLOUR,
      flatShading: true,
      vertexColors: true,
    }),
  );
  // An invisible, wider copy of each stick that clicks are tested against, because the drawn sticks are too thin to hit.
  const stickPickGeometry = track(new THREE.BoxGeometry(STICK_LENGTH_METRES, STICK_PICK_WIDTH_METRES, STICK_PICK_WIDTH_METRES));
  const stickPickMaterial = track(new THREE.MeshBasicMaterial());
  let stickCapacity = 0;
  let sticks = stickGeometries.map((geometry) => new THREE.InstancedMesh(geometry, stickMaterial, 1));
  let stickPickers = new THREE.InstancedMesh(stickPickGeometry, stickPickMaterial, 1);
  makeRoomForSticks(Math.max(1, stickEntities(entities).size));
  let sticksDrawn: Entity[] = [];
  /** Where each drawn stick sits: its shape's batch and its place in that batch. In the same order as `sticksDrawn`. */
  let stickSlots: { shape: number; slot: number }[] = [];
  const stickShade = new THREE.Color();
  const pickMatrix = new THREE.Matrix4();
  const pickOffset = new THREE.Matrix4();
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);

  const stickQuery = stickEntities(entities).connect();
  let sticksDirty = true;
  const markSticks = () => {
    sticksDirty = true;
  };
  stickQuery.onEntityAdded.subscribe(markSticks);
  stickQuery.onEntityRemoved.subscribe(markSticks);

  /** Swaps the stick batches for bigger ones, with room for `capacity` sticks. The old batches are thrown away. */
  function makeRoomForSticks(capacity: number): void {
    for (const batch of sticks) {
      group.remove(batch);
      batch.dispose();
    }
    stickPickers.dispose();
    stickCapacity = capacity;
    sticks = stickGeometries.map((geometry) => {
      const batch = new THREE.InstancedMesh(geometry, stickMaterial, capacity);
      batch.count = 0;
      batch.frustumCulled = false;
      group.add(batch);
      return batch;
    });
    stickPickers = new THREE.InstancedMesh(stickPickGeometry, stickPickMaterial, capacity);
    stickPickers.count = 0;
  }

  function rebuildSticks(): void {
    // Double the room each time it runs out, so a few more sticks do not rebuild the batch every time.
    if (stickQuery.size > stickCapacity) makeRoomForSticks(Math.max(stickQuery.size, stickCapacity * 2));
    sticksDrawn = [];
    stickSlots = [];
    for (const batch of sticks) batch.count = 0;
    for (const stick of stickQuery) {
      // Each stick lies at its own steady angle, picked from its spot.
      rotation.setFromAxisAngle(up, lookFor(stick.position.x, stick.position.z) * Math.PI * 2);
      position.set(stick.position.x, stick.position.y, stick.position.z);
      matrix.compose(position, rotation, scale);
      // Each stick's shape is picked from its spot too, so neighbouring sticks rarely match.
      const shape = Math.min(GROUND_STICK_SHAPE_COUNT - 1, Math.floor(lookFor(stick.position.x + 0.5, stick.position.z - 0.5) * GROUND_STICK_SHAPE_COUNT));
      const batch = sticks[shape];
      const size = stickLengths[shape];
      if (batch === undefined || size === undefined) continue;
      const slot = batch.count;
      batch.count += 1;
      batch.setMatrixAt(slot, matrix);
      // The pick box is stretched and moved along the stick to cover this shape.
      pickOffset.makeTranslation(size.middle, 0, 0).scale(new THREE.Vector3(size.length / STICK_LENGTH_METRES, 1, 1));
      pickMatrix.multiplyMatrices(matrix, pickOffset);
      stickPickers.setMatrixAt(sticksDrawn.length, pickMatrix);
      stickShade.setScalar(1 + (lookFor(stick.position.z, stick.position.x) * 2 - 1) * STICK_SHADE_SPREAD);
      batch.setColorAt(slot, stickShade);
      sticksDrawn.push(stick);
      stickSlots.push({ shape, slot });
    }
    stickPickers.count = sticksDrawn.length;
    for (const batch of sticks) {
      batch.instanceMatrix.needsUpdate = true;
      if (batch.instanceColor !== null) batch.instanceColor.needsUpdate = true;
    }
    stickPickers.instanceMatrix.needsUpdate = true;
    // Clicks test this sphere first, so it must cover the sticks as they lie now.
    stickPickers.computeBoundingSphere();
  }

  return {
    pickers: () => stickPickers,
    update() {
      if (sticksDirty) rebuildSticks();
      sticksDirty = false;
    },
    stickAt: (instanceId) => sticksDrawn[instanceId],
    outlineOf(stick) {
      const where = stickSlots[sticksDrawn.indexOf(stick)];
      const batch = where === undefined ? undefined : sticks[where.shape];
      if (where === undefined || batch === undefined) return [];
      group.updateMatrixWorld();
      batch.getMatrixAt(where.slot, matrix);
      return [{ geometry: batch.geometry, matrix: new THREE.Matrix4().multiplyMatrices(group.matrixWorld, matrix) }];
    },
    dispose() {
      stickQuery.disconnect();
      // The stick batches are swapped when they grow, so they are not tracked.
      for (const batch of sticks) batch.dispose();
      stickPickers.dispose();
    },
  };
}
