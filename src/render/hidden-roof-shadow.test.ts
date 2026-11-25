// Checks that a roof hidden by the wall mode still casts its shadow, and still cannot be picked, without a browser.
import * as THREE from "three";
import { describe, expect, it } from "bun:test";
import { createEntityStore, type EntityStore, type Vec3 } from "../sim/entities";
import { structureOf } from "../sim/structures";
import { SHADOW_ONLY_LAYER } from "./culled-batch";
import { cabinCutaway } from "./cabin-cutaway";
import type { WallMode } from "../wall-mode";
import { createStructureMeshes, type StructureFrame } from "./structure-meshes";

const LOG_SHAPE = { geometry: new THREE.BoxGeometry(0.3, 0.3, 1), restHeight: 0.15 };
const SQUARE = { x: 0.5, z: 0.5 };

/** A finished foundation with a roof frame and a roof on it. */
function roofedSquare(): EntityStore {
  const entities = createEntityStore();
  entities.add({ foundation: true, facing: { turns: 0 }, position: { x: SQUARE.x, y: 0, z: SQUARE.z } });
  for (const kind of ["roofFrame", "roof"] as const) {
    entities.add({ ...structureOf(kind).finish(SQUARE, 0, entities), facing: { turns: 0 }, position: { x: SQUARE.x, y: 0, z: SQUARE.z } });
  }
  return entities;
}

/** The time of the last frame drawn, in seconds. Each frame comes a second after the one before, long enough for any fade to finish. */
let clock = 0;

/** The player, standing inside the cabin. */
const PLAYER: Vec3 = { x: SQUARE.x, y: 0, z: SQUARE.z };

/** One frame of drawing in wall mode `mode`, with the camera up and away to one side. */
function frameIn(entities: EntityStore, mode: WallMode): StructureFrame {
  clock += 1;
  return { nowSeconds: clock, player: PLAYER, cutaway: cabinCutaway(entities, mode, { x: 10, y: 10, z: 10 }, PLAYER) };
}

/** The meshes in `group` that the main camera draws, and the ones that only the sun's shadow camera draws. */
function drawnMeshes(group: THREE.Object3D): { onScreen: number; shadowOnly: number } {
  const screen = new THREE.Layers();
  const shadow = new THREE.Layers();
  shadow.enable(SHADOW_ONLY_LAYER);
  let onScreen = 0;
  let shadowOnly = 0;
  group.traverseVisible((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry as THREE.BufferGeometry;
    const material = object.material as THREE.Material;
    if (!geometry.hasAttribute("position")) return;
    if (!material.visible) return;
    if (object.layers.test(screen)) onScreen += 1;
    else if (object.layers.test(shadow)) shadowOnly += 1;
  });
  return { onScreen, shadowOnly };
}

/** A ray straight down onto the square from above, once `group` is placed. */
function rayDown(group: THREE.Object3D): THREE.Raycaster {
  group.updateMatrixWorld(true);
  return new THREE.Raycaster(new THREE.Vector3(SQUARE.x, 20, SQUARE.z), new THREE.Vector3(0, -1, 0));
}

describe("a roof hidden by the wall mode", () => {
  it("is drawn only into the sun's shadows, with its frame, and shows again in walls up", () => {
    const entities = roofedSquare();
    const meshes = createStructureMeshes(entities, () => 0, LOG_SHAPE);
    meshes.update(frameIn(entities, "wallsUp"));
    const shown = drawnMeshes(meshes.group);

    meshes.update(frameIn(entities, "cutaway"));
    const hidden = drawnMeshes(meshes.group);
    expect(hidden.shadowOnly).toBeGreaterThan(0);
    expect(hidden.onScreen + hidden.shadowOnly).toBe(shown.onScreen);

    meshes.update(frameIn(entities, "wallsUp"));
    expect(drawnMeshes(meshes.group)).toEqual(shown);
    meshes.dispose();
  });

  it("cannot be picked, and its frame neither", () => {
    const entities = roofedSquare();
    const meshes = createStructureMeshes(entities, () => 0, LOG_SHAPE);
    meshes.update(frameIn(entities, "wallsUp"));
    expect(meshes.pickFinished(rayDown(meshes.group))?.entity.cabinRoof).toBe(true);

    meshes.update(frameIn(entities, "cutaway"));
    const picked = meshes.pickFinished(rayDown(meshes.group))?.entity;
    expect(picked?.cabinRoof).toBeUndefined();
    expect(picked?.roofFrame).toBeUndefined();
    meshes.dispose();
  });
});
