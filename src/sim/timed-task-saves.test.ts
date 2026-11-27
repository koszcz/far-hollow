import { describe, expect, it } from "bun:test";
import type { Command } from "./api";
import type { Entity } from "./entities";
import { fishWaitMinutes } from "./fishing";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { groundDistance, type GroundPoint } from "./ground-point";
import { readSave, writeSave } from "./save";
import { TIMED_APPROACHES_SAVE_VERSION } from "./save-versions";
import { CAMPFIRE_STICK_COST } from "./structures";
import { distanceToRiver } from "./valley";
import { isWalkable } from "./walk-map";

// Saves made before timed tasks walked through the approach. Back then, a timed task component, such as `chopTask`, marked
// both the walk to the thing and the work on it. A player saved on the way had the task component and a `walkPath`.

describe("a save from before timed tasks walked through the approach", () => {
  it("turns a chop saved on the way to the tree into an approach, and the player chops on arrival", () => {
    const game = createGame({ seed: 42 });
    const treeId = idOf(game, treeAway(game, 6));
    sendAndStep(game, { type: "chopTree", treeId }, 3);
    expect(onlyPlayer(game).walkPath).toBeDefined();

    const loaded = load(olderSave(game, { chopTask: { treeId, secondsDone: 0 } }));
    expect(onlyPlayer(loaded).approach).toEqual({ command: { type: "chopTree", treeId } });
    expect(onlyPlayer(loaded).chopTask).toBeUndefined();

    stepUntil(loaded, () => loaded.client.getView().action?.kind === "chop");
    expect(onlyPlayer(loaded).chopTask?.treeId).toBe(treeId);
  });

  it("keeps a chop saved partway through, and the chop carries on from its saved progress", () => {
    const game = createGame({ seed: 42 });
    const treeId = idOf(game, treeAway(game, 6));
    sendAndStep(game, { type: "chopTree", treeId }, 1);
    stepUntil(game, () => (onlyPlayer(game).chopTask?.secondsDone ?? 0) >= 1);
    const secondsDone = onlyPlayer(game).chopTask?.secondsDone ?? 0;

    const loaded = load(olderSave(game, {}));
    expect(onlyPlayer(loaded).chopTask).toEqual({ treeId, secondsDone });
    expect(onlyPlayer(loaded).approach).toBeUndefined();

    loaded.step();
    expect(onlyPlayer(loaded).chopTask?.secondsDone).toBeCloseTo(secondsDone + 1 / STEPS_PER_SECOND, 6);
    stepUntil(loaded, () => loaded.entities.entity(treeId)?.stump === true);
  });

  it("turns a build saved on the way to the blueprint into an approach, and the player builds on arrival", () => {
    const game = createGame({ seed: 42 });
    const player = onlyPlayer(game);
    if (player.backpack !== undefined) player.backpack.contents.stick = CAMPFIRE_STICK_COST;
    // A spot on open ground may still be refused, such as one too near a tree, so try spots further out until one is taken.
    for (let metres = 8; metres < 20 && game.entities.with("blueprint").size === 0; metres += 1) {
      sendAndStep(game, { type: "placeBlueprint", structure: "campfire", turns: 0, ...openSpotAway(game, metres) }, 1);
    }
    const blueprint = game.entities.with("blueprint").first;
    if (blueprint === undefined) throw new Error("No blueprint");
    const blueprintId = idOf(game, blueprint);
    sendAndStep(game, { type: "build", blueprintId }, 3);
    expect(onlyPlayer(game).walkPath).toBeDefined();

    const loaded = load(olderSave(game, { buildTask: { blueprintId } }));
    expect(onlyPlayer(loaded).approach).toEqual({ command: { type: "build", blueprintId } });
    expect(onlyPlayer(loaded).buildTask).toBeUndefined();

    stepUntil(loaded, () => loaded.client.getView().action?.kind === "build");
    expect(onlyPlayer(loaded).buildTask).toEqual({ blueprintId });
  });

  it("turns fishing saved on the way to the river into an approach, and the player casts on arrival with the same wait", () => {
    const game = createGame({ seed: 42 });
    const player = onlyPlayer(game);
    if (player.backpack !== undefined) player.backpack.contents.fishingRod = 1;
    // Three casts made earlier, so the cast saved on the way was the fourth.
    player.fishCasts = 3;
    const spot = riverSpotNearPlayer(game);
    sendAndStep(game, { type: "fish", ...spot }, 3);
    expect(onlyPlayer(game).walkPath).toBeDefined();

    // Back then, the player cast as they set off, so the save counts the cast and holds its wait.
    const loaded = load(olderSave(game, { fishTask: { x: spot.x, z: spot.z, minutesWaited: 0, biteAfterMinutes: fishWaitMinutes(42, 3) }, fishCasts: 4 }));
    expect(onlyPlayer(loaded).approach).toEqual({ command: { type: "fish", x: spot.x, z: spot.z } });
    expect(onlyPlayer(loaded).fishTask).toBeUndefined();
    expect(onlyPlayer(loaded).fishCasts).toBe(3);

    stepUntil(loaded, () => loaded.client.getView().action?.kind === "fish");
    expect(onlyPlayer(loaded).fishTask?.biteAfterMinutes).toBe(fishWaitMinutes(42, 3));
    expect(onlyPlayer(loaded).fishCasts).toBe(4);
  });

  it("turns a drink saved on the way to the river into an approach, and the player drinks on arrival", () => {
    const game = createGame({ seed: 42 });
    const spot = riverSpotNearPlayer(game);
    sendAndStep(game, { type: "drinkFromRiver", ...spot }, 3);
    expect(onlyPlayer(game).walkPath).toBeDefined();

    const loaded = load(olderSave(game, { drinkTask: { x: spot.x, z: spot.z } }));
    expect(onlyPlayer(loaded).approach).toEqual({ command: { type: "drinkFromRiver", x: spot.x, z: spot.z } });
    expect(onlyPlayer(loaded)).not.toHaveProperty("drinkTask");

    stepUntil(loaded, () => loaded.client.getView().lastEatOrDrink !== null);
    expect(loaded.client.getView().lastEatOrDrink).toEqual({ count: 1, kind: "drinkFromRiver", toward: { x: spot.x, z: spot.z } });
    expect(loaded.client.getView().sick).toBe(true);
  });
});

/** A standing tree at least `metres` from the player, the nearest such. */
function treeAway(game: Game, metres: number): Entity & { position: { x: number; z: number } } {
  const { position } = onlyPlayer(game);
  const trees = [...game.entities.with("tree", "position")]
    .map((tree) => ({ tree, distance: groundDistance(tree.position, position) }))
    .filter(({ distance }) => distance >= metres)
    .sort((a, b) => a.distance - b.distance);
  const tree = trees[0]?.tree;
  if (tree === undefined) throw new Error("No tree far enough away");
  return tree;
}

/** A spot in the river, east of the player, at least 1 m from the water's edge. */
function riverSpotNearPlayer(game: Game): GroundPoint {
  const { position } = onlyPlayer(game);
  for (let x = position.x; x < position.x + 100; x += 0.25) {
    const spot = { x, z: position.z };
    if (distanceToRiver(game.valley.river, spot) - game.valley.river.width / 2 < -1) return spot;
  }
  throw new Error("No river near the player");
}

/** An open spot about `distance` metres from the player. */
function openSpotAway(game: Game, distance: number): GroundPoint {
  const { position } = onlyPlayer(game);
  for (let turn = 0; turn < 64; turn += 1) {
    const angle = (turn / 64) * 2 * Math.PI;
    const spot = { x: position.x + Math.cos(angle) * distance, z: position.z + Math.sin(angle) * distance };
    if (isWalkable(game.walkMap, spot)) return spot;
  }
  throw new Error("No open spot");
}

/**
 * A save of the game as the version before timed tasks walked through the approach would have written it.
 * The player's approach, if any, is replaced by the task components given, written as that version wrote them.
 */
function olderSave(game: Game, tasks: Record<string, unknown>): unknown {
  const save = JSON.parse(JSON.stringify(writeSave(game))) as { version: number; entities: { components: Record<string, unknown> }[] };
  save.version = TIMED_APPROACHES_SAVE_VERSION - 1;
  for (const entity of save.entities) {
    if (entity.components.player !== true) continue;
    if (Object.keys(tasks).length > 0) delete entity.components.approach;
    Object.assign(entity.components, tasks);
  }
  return save;
}

function load(save: unknown): Game {
  const loaded = readSave(save);
  if (!loaded.ok) throw new Error("The save did not load");
  return loaded.game;
}

function sendAndStep(game: Game, command: Command, steps: number): void {
  game.client.send(command);
  for (let i = 0; i < steps; i += 1) game.step();
}

function stepUntil(game: Game, done: () => boolean, maxSteps = 100_000): void {
  for (let i = 0; i < maxSteps; i += 1) {
    if (done()) return;
    game.step();
  }
  throw new Error("Gave up waiting");
}

function onlyPlayer(game: Game): Entity & { position: { x: number; z: number } } {
  const player = game.entities.with("player", "position").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity has no id");
  return id;
}
