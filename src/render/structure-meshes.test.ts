// Checks that every structure kind is drawn through the one structure meshes module, without a browser.
import * as THREE from "three";
import { describe, expect, it } from "bun:test";
import { createEntityStore } from "../sim/entities";
import { STRUCTURES } from "../sim/structures";
import { createStructureMeshes } from "./structure-meshes";

const LOG_SHAPE = { geometry: new THREE.BoxGeometry(0.3, 0.3, 1), restHeight: 0.15 };

describe.each(STRUCTURES.map(({ kind }) => kind))("drawing a %s blueprint", (kind) => {
  it("draws it while it exists, outlines it, and forgets it once it is gone", () => {
    const entities = createEntityStore();
    const meshes = createStructureMeshes(entities, () => 0, LOG_SHAPE);
    const blueprint = entities.add({
      blueprint: { structure: kind, progress: 0.5, materialsSpent: 1, delivered: {} },
      position: { x: 3, y: 0, z: 4 },
      facing: { turns: 0 },
    });

    meshes.update({ nowSeconds: 0 });
    expect(meshes.outlineOf({ kind: "blueprint", entity: blueprint }).length).toBeGreaterThan(0);

    entities.remove(blueprint);
    meshes.update({ nowSeconds: 0 });
    expect(meshes.outlineOf({ kind: "blueprint", entity: blueprint })).toEqual([]);
    meshes.dispose();
  });

  it("shows it under the mouse while the player places one, and hides it after", () => {
    const meshes = createStructureMeshes(createEntityStore(), () => 0, LOG_SHAPE);
    const visibleMeshes = () => {
      let count = 0;
      meshes.group.traverseVisible((object) => {
        if (object instanceof THREE.Mesh) count += 1;
      });
      return count;
    };
    const hidden = visibleMeshes();

    meshes.showPlacingBlueprint({ structure: kind, spot: { x: 0, y: 0, z: 0 }, turns: 0, allowed: true });
    expect(visibleMeshes()).toBeGreaterThan(hidden);

    meshes.showPlacingBlueprint(undefined);
    expect(visibleMeshes()).toBe(hidden);
    meshes.dispose();
  });
});
