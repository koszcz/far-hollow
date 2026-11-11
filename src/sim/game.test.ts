import { describe, expect, it } from "vitest";
import { createGame } from "./game";
import { generateValley, terrainHeightAt } from "./valley";

describe("createGame", () => {
  it("lays out its valley from the seed it is given", () => {
    const game = createGame({ seed: 42 });
    expect(game.valley).toEqual(generateValley(42));
    expect(game.client.getView().seed).toBe(42);
  });

  it("adds one tree entity, standing on the ground, for each tree in the valley", () => {
    const game = createGame({ seed: 42 });
    const trees = game.entities.with("tree", "position").entities;
    expect(trees).toHaveLength(game.valley.trees.length);
    const expected = game.valley.trees.map((tree) => ({
      x: tree.x,
      y: terrainHeightAt(game.valley.terrain, tree.x, tree.z),
      z: tree.z,
    }));
    const byPlace = (a: { x: number; z: number }, b: { x: number; z: number }) => a.x - b.x || a.z - b.z;
    expect(trees.map((tree) => tree.position).sort(byPlace)).toEqual(expected.sort(byPlace));
    expect(game.client.getView().entityCount).toBe(trees.length);
  });
});
