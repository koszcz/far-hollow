import { describe, expect, it } from "vitest";
import { createGame, STEPS_PER_SECOND } from "./game";
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

describe("the game clock", () => {
  function runRealSeconds(game: ReturnType<typeof createGame>, seconds: number): void {
    for (let i = 0; i < seconds * STEPS_PER_SECOND; i += 1) game.step();
  }

  it("starts on day 1 at 08:00", () => {
    const game = createGame({ seed: 1 });
    expect(game.client.getView().time).toMatchObject({ day: 1, hour: 8, minute: 0 });
  });

  it("moves one game hour for each real minute of logic steps", () => {
    const game = createGame({ seed: 1 });
    runRealSeconds(game, 60);
    expect(game.client.getView().time).toMatchObject({ day: 1, hour: 9, minute: 0 });
  });

  it("stands still while the game is paused", () => {
    const game = createGame({ seed: 1 });
    game.client.send({ type: "setPaused", paused: true });
    runRealSeconds(game, 60);
    expect(game.client.getView().time).toMatchObject({ day: 1, hour: 8, minute: 0 });
  });

  it("skips forward when the client sends a skip-time command", () => {
    const game = createGame({ seed: 1 });
    game.client.send({ type: "skipTime", hours: 13 });
    game.step();
    expect(game.client.getView().time).toMatchObject({ day: 1, hour: 21, minute: 0 });
  });
});
