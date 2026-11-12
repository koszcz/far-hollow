import { describe, expect, it } from "bun:test";
import { distanceOutside } from "./building";
import { stickEntities, treeEntities } from "./entities";
import { createGame, type Game } from "./game";
import { STICK_GAP_FROM_PLACED_METRES } from "./stick-fall";
import { footprintOfEntity, placedStructures } from "./structures";
import { groundDistance, type GroundPoint } from "./valley";

function stickCount(game: Game): number {
  return stickEntities(game.entities).entities.length;
}

/** Takes this many sticks off the ground, as if the player had gathered them. */
function clearSticks(game: Game, count: number): void {
  for (const stick of [...stickEntities(game.entities)].slice(0, count)) game.entities.remove(stick);
}

function skipHours(game: Game, hours: number): void {
  game.client.send({ type: "skipTime", hours });
  game.step();
}

function sticksWhere(game: Game, where: (spot: GroundPoint) => boolean) {
  return stickEntities(game.entities).entities.filter((stick) => where(stick.position));
}

/** The sticks that lie on the ground now but were not among `before`. */
function newSticks(game: Game, before: ReadonlySet<object>) {
  return stickEntities(game.entities).entities.filter((stick) => !before.has(stick));
}

function stickSpots(game: Game): string[] {
  return stickEntities(game.entities)
    .entities.map(({ position }) => `${position.x.toFixed(3)},${position.z.toFixed(3)}`)
    .sort();
}

describe("sticks falling from the trees", () => {
  it("lays new sticks on the ground after the player gathers some", () => {
    const game = createGame({ seed: 42 });
    const start = stickCount(game);
    clearSticks(game, 200);
    skipHours(game, 24);
    expect(stickCount(game)).toBeGreaterThan(start - 200);
  });

  it("lays them under standing trees, not on the spots the player cleared", () => {
    const game = createGame({ seed: 42 });
    const cleared = sticksWhere(game, () => true)
      .slice(0, 200)
      .map(({ position }) => ({ x: position.x, z: position.z }));
    clearSticks(game, 200);
    const before = new Set(stickEntities(game.entities).entities);
    skipHours(game, 2 * 24);
    const fallen = newSticks(game, before);
    expect(fallen.length).toBeGreaterThan(0);
    const trees = treeEntities(game.entities).entities.map((tree) => tree.position);
    for (const { position } of fallen) {
      expect(cleared.some((spot) => spot.x === position.x && spot.z === position.z)).toBe(false);
      expect(trees.some((tree) => groundDistance(tree, position) <= 4)).toBe(true);
    }
  });

  it("lays most of them in deadfalls, and some alone", () => {
    const game = createGame({ seed: 42 });
    clearSticks(game, 400);
    const before = new Set(stickEntities(game.entities).entities);
    skipHours(game, 2 * 24);
    const fallen = newSticks(game, before);
    const alone = fallen.filter((stick) => !fallen.some((other) => other !== stick && groundDistance(other.position, stick.position) < 1));
    expect(alone.length).toBeGreaterThan(0);
    expect(alone.length).toBeLessThan(fallen.length / 2);
  });

  it("fills a cleared area under the trees again within a few days", () => {
    const game = createGame({ seed: 42 });
    const middle = game.valley.trees[100] as GroundPoint;
    const near = (stick: GroundPoint) => groundDistance(stick, middle) < 20;
    const startNear = sticksWhere(game, near).length;
    for (const stick of sticksWhere(game, near)) game.entities.remove(stick);
    skipHours(game, 3 * 24);
    expect(sticksWhere(game, near).length).toBeGreaterThan(startNear / 2);
  });
});

describe("the limit on sticks", () => {
  it("never lays more sticks than a new valley starts with", () => {
    const game = createGame({ seed: 42 });
    const start = stickCount(game);
    clearSticks(game, 30);
    skipHours(game, 5 * 24);
    expect(stickCount(game)).toBe(start);
  });

  it("counts sticks the player dropped", () => {
    const game = createGame({ seed: 42 });
    const start = stickCount(game);
    clearSticks(game, 50);
    // The player drops 50 sticks by their feet.
    const { x, y, z } = game.client.getView().playerPosition;
    for (let i = 0; i < 50; i += 1) game.entities.add({ stick: true, position: { x: x + i * 0.01, y, z } });
    skipHours(game, 3 * 24);
    expect(stickCount(game)).toBe(start);
  });
});

describe("the gap around built things", () => {
  it("lays no stick on or right next to anything the player has built or placed", () => {
    const game = createGame({ seed: 42 });
    const tree = game.valley.trees[100] as GroundPoint;
    const bedroll = { x: tree.x - 2.5, z: tree.z };
    game.entities.add({ campfire: { lit: false, fuelMinutes: 0 }, position: { x: tree.x + 2.5, y: 0, z: tree.z } });
    game.entities.add({ bedroll: true, position: { ...bedroll, y: 0 } });
    const near = (stick: GroundPoint) => groundDistance(stick, tree) < 30;
    for (const stick of sticksWhere(game, near)) game.entities.remove(stick);
    skipHours(game, 6 * 24);
    expect(sticksWhere(game, near).length).toBeGreaterThan(0);
    const campfire = placedStructures(game.entities)[0];
    if (campfire === undefined) throw new Error("The campfire is missing");
    for (const { position } of sticksWhere(game, near)) {
      expect(distanceOutside(footprintOfEntity(campfire.entity), position)).toBeGreaterThanOrEqual(STICK_GAP_FROM_PLACED_METRES);
      expect(groundDistance(position, bedroll)).toBeGreaterThanOrEqual(STICK_GAP_FROM_PLACED_METRES);
    }
  });
});

describe("sticks falling after a load", () => {
  it("keeps the same pace as the game that was saved", () => {
    const played = createGame({ seed: 42 });
    clearSticks(played, 300);
    skipHours(played, 7.5);
    const loaded = createGame({ seed: 42, progress: played.progress() });
    skipHours(played, 24);
    skipHours(loaded, 24);
    expect(stickCount(played)).toBeGreaterThan(stickCount(createGame({ seed: 42 })) - 300);
    expect(stickSpots(loaded)).toEqual(stickSpots(played));
  });

  it("lays new sticks in a game saved before sticks fell again", () => {
    const played = createGame({ seed: 42 });
    clearSticks(played, 300);
    const progress = played.progress();
    const oldSave = { ...progress, entities: progress.entities.filter(({ components }) => components.stickFall === undefined) };
    const loaded = createGame({ seed: 42, progress: oldSave });
    const before = stickCount(loaded);
    skipHours(loaded, 24);
    expect(stickCount(loaded)).toBeGreaterThan(before);
  });
});
