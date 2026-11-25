// Checks that the roof frame blueprint under the mouse takes the shape it will have once placed, without a browser.
import * as THREE from "three";
import { describe, expect, it } from "bun:test";
import { createEntityStore, type EntityStore } from "../sim/entities";
import type { QuarterTurns } from "../sim/quarter-turns";
import { createRoofFrameMeshes } from "./roof-frame-meshes";

describe("the roof frame blueprint under the mouse", () => {
  it("shows the ridge section it will become in the middle of a roof 3 squares deep", () => {
    // The back row slopes down to -z, and the front two slope down to +z, so the middle square becomes a ridge section.
    const entities = createEntityStore();
    addFrame(entities, 0.5, 2);
    addFrame(entities, 2.5, 0);
    const meshes = createRoofFrameMeshes(entities);
    meshes.update();
    const before = visibleGeometries(meshes.group);

    const middle = { x: 0.5, y: 0, z: 1.5 };
    meshes.showPlacingBlueprint({ spot: middle, turns: 0, allowed: true });
    const ghost = visibleGeometries(meshes.group).filter((geometry) => !before.includes(geometry));
    meshes.showPlacingBlueprint(undefined);

    const placed = entities.add({
      blueprint: { structure: "roofFrame", progress: 0, materialsSpent: 0, delivered: {} },
      position: middle,
      facing: { turns: 0 },
    });
    meshes.update();
    const drawn = meshes.outlineOf({ kind: "blueprint", entity: placed }).map(({ geometry }) => geometry);
    const shaped = drawn.filter((geometry) => "position" in geometry.attributes);

    expect(shaped.length).toBeGreaterThan(0);
    for (const geometry of shaped) expect(ghost).toContain(geometry);
    meshes.dispose();
  });
});

function addFrame(entities: EntityStore, z: number, turns: QuarterTurns): void {
  entities.add({ roofFrame: true, position: { x: 0.5, y: 0, z }, facing: { turns } });
}

function visibleGeometries(group: THREE.Group): THREE.BufferGeometry[] {
  const found: THREE.BufferGeometry[] = [];
  group.traverseVisible((object) => {
    if (object instanceof THREE.Mesh) found.push(object.geometry as THREE.BufferGeometry);
  });
  return found;
}
