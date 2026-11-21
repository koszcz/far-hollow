import { describe, expect, it } from "bun:test";
import type { Command } from "./api";
import type { Entity } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { groundDistance } from "./ground-point";
import { readSave, TIMED_APPROACHES_SAVE_VERSION, writeSave } from "./save";

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
