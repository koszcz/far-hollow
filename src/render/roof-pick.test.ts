// Checks that a click on the high part of a roof frame or roof section lands on it, without a browser.
import * as THREE from "three";
import { describe, expect, it } from "bun:test";
import { createEntityStore, type Entity, type EntityStore } from "../sim/entities";
import type { QuarterTurns } from "../sim/quarter-turns";
import { structureOf } from "../sim/structures";
import { createRoofFrameMeshes } from "./roof-frame-meshes";
import { createRoofMeshes } from "./roof-meshes";
import { FRAME_TOP_METRES, RAFTER_RADIUS_METRES, SECTION_RISE_METRES } from "./roof-parts";

/** The middle of the middle square of a cabin 3 squares wide along x, whose ridge runs along its middle column. */
const MIDDLE = { x: 1.5, z: 0.5 };

/**
 * Frames on a row of 3 squares along x: the outer two slope away from the middle, so the middle frame is a ridge section.
 * `roofs` lays a roof on the frames of these columns.
 */
function threeWideCabin(roofs: readonly number[]): { entities: EntityStore; middleFrame: Entity; middleRoof: Entity | undefined } {
  const entities = createEntityStore();
  let middleFrame: Entity | undefined;
  let middleRoof: Entity | undefined;
  const turnsOf: readonly QuarterTurns[] = [1, 1, 3];
  for (const column of [0, 1, 2]) {
    const square = { x: column + 0.5, z: MIDDLE.z };
    const position = { x: square.x, y: 0, z: square.z };
    const turns = turnsOf[column] ?? 0;
    entities.add({ foundation: true, facing: { turns: 0 }, position: { ...position } });
    const frame = entities.add({ ...structureOf("roofFrame").finish(square, turns, entities), facing: { turns }, position: { ...position } });
    if (column === 1) middleFrame = frame;
    if (!roofs.includes(column)) continue;
    const roof = entities.add({ ...structureOf("roof").finish(square, turns, entities), facing: { turns }, position: { ...position } });
    if (column === 1) middleRoof = roof;
  }
  if (middleFrame === undefined) throw new Error("No middle frame");
  return { entities, middleFrame, middleRoof };
}

/** A ray from `from` towards `to`. */
function rayBetween(from: THREE.Vector3, to: THREE.Vector3): THREE.Raycaster {
  return new THREE.Raycaster(from, to.clone().sub(from).normalize());
}

/** Where a ray straight down onto the middle square meets the first thing `pick` finds, and what it found. */
function pickDown(pick: (raycaster: THREE.Raycaster) => { entity: Entity; distance: number } | undefined) {
  const top = 20;
  const hit = pick(rayBetween(new THREE.Vector3(MIDDLE.x, top, MIDDLE.z), new THREE.Vector3(MIDDLE.x, 0, MIDDLE.z)));
  return hit === undefined ? undefined : { entity: hit.entity, y: top - hit.distance };
}

describe("picking a roof frame", () => {
  it("catches a click on the rafters up at the ridge, not only at the level of the wall tops", () => {
    const { entities, middleFrame } = threeWideCabin([0, 2]);
    const frames = createRoofFrameMeshes(entities);
    frames.update();
    frames.group.updateMatrixWorld(true);

    const down = pickDown((ray) => frames.pickFinished(ray));
    expect(down?.entity).toBe(middleFrame);
    // The ridge stands about half a rise above the beams.
    expect(down?.y ?? 0).toBeGreaterThan(FRAME_TOP_METRES + SECTION_RISE_METRES / 2);

    // From a camera up and off to one side, a ray aimed at the ridge passes over the wall tops beyond it. It still finds the frame.
    const ridge = new THREE.Vector3(MIDDLE.x, down?.y ?? 0, MIDDLE.z);
    for (const from of [new THREE.Vector3(MIDDLE.x + 8, ridge.y + 8, MIDDLE.z), new THREE.Vector3(MIDDLE.x, ridge.y + 8, MIDDLE.z + 8)]) {
      expect(frames.pickFinished(rayBetween(from, ridge))?.entity).toBe(middleFrame);
    }
    frames.dispose();
  });
});

describe("picking a roof section", () => {
  it("catches a click on its planks up at the ridge", () => {
    const { entities, middleRoof } = threeWideCabin([0, 1, 2]);
    const roofs = createRoofMeshes(entities);
    roofs.update();
    roofs.group.updateMatrixWorld(true);

    const down = pickDown((ray) => roofs.pickFinished(ray));
    expect(down?.entity).toBe(middleRoof);
    // The planks lie on the rafters, which rise to the ridge about half a rise above the beams.
    expect(down?.y ?? 0).toBeGreaterThan(FRAME_TOP_METRES + 2 * RAFTER_RADIUS_METRES + SECTION_RISE_METRES / 2);
    roofs.dispose();
  });
});
