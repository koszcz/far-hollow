import * as THREE from "three";
import { describe, expect, it } from "bun:test";
import { createEntityStore } from "../sim/entities";
import { createForestMeshes } from "./forest-meshes";

function forestWithSticks(count: number) {
  const store = createEntityStore();
  for (let i = 0; i < count; i += 1) store.add({ stick: true, position: { x: i, y: 0, z: 0 } });
  const forest = createForestMeshes(
    store,
    [],
    { geometry: new THREE.BoxGeometry(), footRadius: 0.3, height: 0.4 },
    { geometry: new THREE.BoxGeometry(), restHeight: 0.15 },
  );
  return { store, forest };
}

describe("sticks on the ground", () => {
  it("draws sticks added after the valley was made, beyond the sticks it started with", () => {
    const { store, forest } = forestWithSticks(2);
    // Taking down a lean-to can leave more sticks on the ground than the valley started with.
    const added = [5, 6, 7, 8].map((x) => store.add({ stick: true, position: { x, y: 0, z: 0 } }));
    forest.update(0);
    for (const stick of added) expect(forest.outlineOf({ kind: "stick", entity: stick })).toHaveLength(1);
    forest.dispose();
  });

  it("draws sticks in a valley that started with none", () => {
    const { store, forest } = forestWithSticks(0);
    const stick = store.add({ stick: true, position: { x: 1, y: 0, z: 0 } });
    const another = store.add({ stick: true, position: { x: 2, y: 0, z: 0 } });
    forest.update(0);
    expect(forest.outlineOf({ kind: "stick", entity: stick })).toHaveLength(1);
    expect(forest.outlineOf({ kind: "stick", entity: another })).toHaveLength(1);
    forest.dispose();
  });
});
