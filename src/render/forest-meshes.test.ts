import * as THREE from "three";
import { describe, expect, it } from "bun:test";
import { createEntityStore } from "../sim/entities";
import { createForestMeshes, type ForestShapes } from "./forest-meshes";
import { createWindSway } from "./wind-sway";

const noTree = { name: "none", trunk: new THREE.BoxGeometry(), crown: new THREE.BoxGeometry(), trunkTone: "light", crownTone: "light" } as const;

function testShapes(): ForestShapes {
  return {
    trees: [],
    saplings: { pine: noTree, leafy: noTree },
    stump: { geometry: new THREE.BoxGeometry(), footRadius: 0.3, height: 0.4 },
    log: { geometry: new THREE.BoxGeometry(), restHeight: 0.15 },
  };
}

function forestWithSticks(count: number) {
  const store = createEntityStore();
  for (let i = 0; i < count; i += 1) store.add({ stick: true, position: { x: i, y: 0, z: 0 } });
  const forest = createForestMeshes(store, testShapes(), createWindSway());
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

/** A store with a finished sawhorse at (10, 0.5, 20) facing `turns`, a debarked log on the ground beside it, and a player. */
function sawhorseWithLog(turns: 0 | 1) {
  const store = createEntityStore();
  const sawhorse = store.add({ workStation: "sawhorse", facing: { turns }, position: { x: 10, y: 0.5, z: 20 } });
  const log = store.add({ debarkedLog: { heading: 0.3 }, position: { x: 10, y: 0.4, z: 21.2 } });
  const player = store.add({
    player: true,
    position: { x: 10, y: 0.5, z: 18.8 },
    previousPosition: { x: 10, y: 0.5, z: 18.8 },
    backpack: { contents: { saw: 1 } },
  });
  const forest = createForestMeshes(store, testShapes(), createWindSway());
  const sawhorseId = store.id(sawhorse) ?? -1;
  const startSawing = () => {
    store.addComponent(player, "craftTask", { recipe: "planks", secondsDone: 2, stationId: sawhorseId });
  };
  const walkToSaw = () => {
    store.addComponent(player, "approach", { command: { type: "craft", recipe: "planks", stationId: sawhorseId } });
    store.addComponent(player, "walkPath", [{ x: 10, z: 19 }]);
  };
  return { store, forest, log, player, startSawing, walkToSaw };
}

/** Where a debarked log is drawn: its middle, and which way its length runs. */
function drawnLog(forest: ReturnType<typeof createForestMeshes>, log: Parameters<typeof forest.outlineOf>[0]["entity"]) {
  const [part] = forest.outlineOf({ kind: "debarkedLog", entity: log });
  if (part === undefined) throw new Error("The log is not drawn");
  const middle = new THREE.Vector3().applyMatrix4(part.matrix);
  const along = new THREE.Vector3(0, 0, 1).transformDirection(part.matrix);
  return { middle, along };
}

describe("the debarked log the player saws", () => {
  it("is drawn lying along the top of the sawhorse beam while the player cuts planks, and its place in the game does not change", () => {
    const { forest, log, startSawing } = sawhorseWithLog(0);
    startSawing();
    forest.update(0);
    const { middle, along } = drawnLog(forest, log);
    // The beam's top is 0.75 m above the sawhorse's foot. The log's underside rests on it.
    expect(middle.x).toBeCloseTo(10);
    expect(middle.y).toBeCloseTo(0.5 + 0.75 + 0.15);
    expect(middle.z).toBeCloseTo(20);
    // A sawhorse facing the default way has its beam along x.
    expect(Math.abs(along.x)).toBeCloseTo(1);
    expect(log.position).toEqual({ x: 10, y: 0.4, z: 21.2 });
    forest.dispose();
  });

  it("lies along a turned beam", () => {
    const { forest, log, startSawing } = sawhorseWithLog(1);
    startSawing();
    forest.update(0);
    expect(Math.abs(drawnLog(forest, log).along.z)).toBeCloseTo(1);
    forest.dispose();
  });

  it("is drawn back in its spot on the ground when the player stops partway", () => {
    const { store, forest, log, player, startSawing } = sawhorseWithLog(0);
    startSawing();
    forest.update(0);
    store.removeComponent(player, "craftTask");
    forest.update(0.1);
    const { middle } = drawnLog(forest, log);
    expect(middle.x).toBeCloseTo(10);
    expect(middle.y).toBeCloseTo(0.4 + 0.15);
    expect(middle.z).toBeCloseTo(21.2);
    forest.dispose();
  });

  it("stays on the ground while the player only walks to the sawhorse", () => {
    const { forest, log, walkToSaw } = sawhorseWithLog(0);
    walkToSaw();
    forest.update(0);
    expect(drawnLog(forest, log).middle.y).toBeCloseTo(0.4 + 0.15);
    forest.dispose();
  });
});
