import { describe, expect, it } from "bun:test";
import type { Command } from "./api-commands";
import type { Goal } from "./api";
import { edgeMiddle } from "./edge-pieces";
import type { Entity } from "./entities";
import { foundationDeckTop } from "./foundations";
import { createGame, type Game } from "./game";
import type { GroundPoint } from "./ground-point";
import { JOURNAL_SAVE_VERSION, readSave, SAVE_VERSION, writeSave } from "./save";
import { structureOf } from "./structures";
import { finishReach } from "./test-steps";

describe("the journal goals", () => {
  it("starts a new game with no goal done", () => {
    const game = createGame({ seed: 42 });

    expect(game.client.getView().journal).toEqual({ done: [], hidden: false, justDone: null });
  });

  it("marks picking up sticks done once the player picks up a stick", () => {
    const game = createGame({ seed: 42 });
    const stick = nearest(game, game.entities.with("stick", "position").entities);

    game.client.send({ type: "pickUpStick", stickId: idOf(game, stick) });
    stepUntil(game, () => (game.client.getView().backpack.stick ?? 0) > 0);
    game.step();

    expect(doneGoals(game)).toEqual(["pickUpSticks"]);
  });

  it("marks picking up sticks done even when the next queued action drops the stick in the same step", () => {
    const game = createGame({ seed: 42 });
    const stick = nearest(game, game.entities.with("stick", "position").entities);

    const stickId = idOf(game, stick);

    game.client.send({ type: "queueAction", action: { type: "pickUpStick", stickId } });
    game.client.send({ type: "queueAction", action: { type: "dropFromBackpack", content: "stick" } });
    stepUntil(game, () => game.entities.entity(stickId) === undefined && game.client.getView().actionQueue.length === 0);
    game.step();

    expect(game.client.getView().backpack.stick ?? 0).toBe(0);
    expect(doneGoals(game)).toEqual(["pickUpSticks"]);
  });

  it("marks lighting a campfire done once a campfire burns, but not for an unlit one", () => {
    const game = createGame({ seed: 42 });
    const campfire = game.entities.add<Entity & { campfire: { lit: boolean } }>({ campfire: { lit: false, fuelMinutes: 30 }, position: besidePlayer(game) });
    game.step();
    expect(doneGoals(game)).toEqual([]);

    campfire.campfire.lit = true;
    game.step();

    expect(doneGoals(game)).toEqual(["lightCampfire"]);
  });

  it("marks felling a tree done once the player chops one down", () => {
    const game = createGame({ seed: 42 });
    const tree = nearest(game, game.entities.with("tree", "position").entities);

    game.client.send({ type: "chopTree", treeId: idOf(game, tree) });
    stepUntil(game, () => game.entities.with("stump").first !== undefined);
    game.step();

    expect(doneGoals(game)).toEqual(["fellTree"]);
  });

  it("marks building a lean-to done once one is finished", () => {
    const game = createGame({ seed: 42 });
    game.entities.add({ ...structureOf("leanTo").finish(besidePlayer(game), 0, game.entities), facing: { turns: 0 }, position: besidePlayer(game) });
    game.step();

    expect(doneGoals(game)).toEqual(["buildLeanTo"]);
  });

  it("marks sleeping on a bedroll done once the player sleeps on one, wherever it lies", () => {
    const game = createGame({ seed: 42 });
    send(game, { type: "layBedroll" });
    const bedroll = game.entities.with("bedroll", "position").first;
    if (bedroll === undefined) throw new Error("No bedroll");

    send(game, { type: "sleep", bedrollId: idOf(game, bedroll) });

    expect(doneGoals(game)).toEqual(["sleepOnBedroll"]);
  });

  it("marks cutting a plank done once the player has a plank", () => {
    const game = createGame({ seed: 42 });
    onlyPlayer(game).backpack.contents.plank = 4;
    game.step();

    expect(doneGoals(game)).toEqual(["cutPlank"]);
  });

  it("marks building a first room done once a room stands, and making it snug once it has a floor", () => {
    const game = createGame({ seed: 42 });
    const square = roomNearPlayer(game);
    game.step();
    expect(doneGoals(game)).toEqual(["buildRoom"]);

    game.entities.add({ floor: true, position: { x: square.x, y: foundationDeckTop(game.valley.terrain, square), z: square.z } });
    game.step();

    expect(doneGoals(game)).toEqual(["buildRoom", "makeRoomSnug"]);
  });

  it("marks goals done out of order, as they happen", () => {
    const game = createGame({ seed: 42 });
    onlyPlayer(game).backpack.contents.plank = 4;
    game.step();
    onlyPlayer(game).backpack.contents.stick = 2;
    game.step();

    expect(doneGoals(game)).toEqual(["cutPlank", "pickUpSticks"]);
  });

  it("keeps a goal done after the player takes the thing down", () => {
    const game = createGame({ seed: 42 });
    const leanTo = game.entities.add({ leanTo: true, position: besidePlayer(game) });
    game.step();
    game.entities.remove(leanTo);
    game.step();

    expect(doneGoals(game)).toEqual(["buildLeanTo"]);
  });
});

describe("the notice that a goal is done", () => {
  it("says so the first time, for a few seconds, and not again", () => {
    const game = createGame({ seed: 42 });
    onlyPlayer(game).backpack.contents.stick = 2;
    game.step();
    expect(justDone(game)).toBe("pickUpSticks");

    game.client.send({ type: "skipTime", hours: 1 });
    game.step();
    expect(justDone(game)).toBeNull();
    onlyPlayer(game).backpack.contents.stick = 0;
    game.step();
    onlyPlayer(game).backpack.contents.stick = 2;
    game.step();

    expect(justDone(game)).toBeNull();
  });

  it("says each goal done in turn, once the one before has gone", () => {
    const game = createGame({ seed: 42 });
    onlyPlayer(game).backpack.contents.stick = 2;
    onlyPlayer(game).backpack.contents.plank = 2;
    game.step();
    expect(justDone(game)).toBe("pickUpSticks");

    stepUntil(game, () => justDone(game) !== "pickUpSticks");

    expect(justDone(game)).toBe("cutPlank");
  });

  it("leaves the game's own notices alone", () => {
    const game = createGame({ seed: 42 });
    onlyPlayer(game).backpack.contents.stick = 2;
    game.step();

    expect(game.client.getView().notice).toBeNull();
  });
});

describe("hiding the journal", () => {
  it("still marks goals done, but no notice says so", () => {
    const game = createGame({ seed: 42 });
    game.client.send({ type: "setJournalHidden", hidden: true });
    game.step();
    onlyPlayer(game).backpack.contents.stick = 2;
    game.step();

    expect(game.client.getView().journal).toEqual({ done: ["pickUpSticks"], hidden: true, justDone: null });
  });

  it("shows the journal again when the player turns the toggle off", () => {
    const game = createGame({ seed: 42 });
    game.client.send({ type: "setJournalHidden", hidden: true });
    game.step();
    game.client.send({ type: "setJournalHidden", hidden: false });
    game.step();

    expect(game.client.getView().journal?.hidden).toBe(false);
  });
});

describe("the playground", () => {
  it("has no journal, and marks no goal done", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    onlyPlayer(game).backpack.contents.stick = 2;
    game.step();

    expect(game.client.getView().journal).toBeNull();
    expect(game.progress().journal.done).toEqual([]);
  });
});

describe("saving the journal", () => {
  it("keeps the goals done and the hide toggle through a save and load", () => {
    const game = createGame({ seed: 42 });
    onlyPlayer(game).backpack.contents.plank = 2;
    game.step();
    game.client.send({ type: "setJournalHidden", hidden: true });
    game.step();

    const loaded = load(JSON.parse(JSON.stringify(writeSave(game))));

    expect(loaded.client.getView().journal).toEqual({ done: ["cutPlank"], hidden: true, justDone: null });
  });

  it("loads an older save with no camp with no goal done and the journal shown", () => {
    expect(JOURNAL_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    const game = createGame({ seed: 42 });

    expect(load(olderSave(game)).client.getView().journal).toEqual({ done: [], hidden: false, justDone: null });
  });

  it("marks done every goal up to the lean-to in an older save that has one, with no notice", () => {
    const game = createGame({ seed: 42 });
    game.entities.add({ leanTo: true, position: besidePlayer(game) });

    const loaded = load(olderSave(game));
    expect(loaded.client.getView().journal).toEqual({
      done: ["pickUpSticks", "lightCampfire", "fellTree", "buildLeanTo"],
      hidden: false,
      justDone: null,
    });
    loaded.step();

    expect(justDone(loaded)).toBeNull();
    expect(doneGoals(loaded)).toEqual(["pickUpSticks", "lightCampfire", "fellTree", "buildLeanTo"]);
  });

  it("marks done every goal up to cutting a plank in an older save with a sawhorse", () => {
    const game = createGame({ seed: 42 });
    game.entities.add({ workStation: "sawhorse", facing: { turns: 0 }, position: besidePlayer(game) });

    expect(doneGoals(load(olderSave(game)))).toEqual(["pickUpSticks", "lightCampfire", "fellTree", "buildLeanTo", "sleepOnBedroll", "cutPlank"]);
  });

  it("marks every goal up to a snug room done in an older save with a snug room", () => {
    const game = createGame({ seed: 42 });
    const square = roomNearPlayer(game);
    game.entities.add({ floor: true, position: { x: square.x, y: foundationDeckTop(game.valley.terrain, square), z: square.z } });

    const loaded = load(olderSave(game));
    loaded.step();

    expect(doneGoals(loaded)).toEqual(["pickUpSticks", "lightCampfire", "fellTree", "buildLeanTo", "sleepOnBedroll", "cutPlank", "buildRoom", "makeRoomSnug"]);
    expect(justDone(loaded)).toBeNull();
  });

  it("marks done only the room and the goals before it when an older save's room is not snug", () => {
    const game = createGame({ seed: 42 });
    roomNearPlayer(game);

    expect(doneGoals(load(olderSave(game)))).toEqual(["pickUpSticks", "lightCampfire", "fellTree", "buildLeanTo", "sleepOnBedroll", "cutPlank", "buildRoom"]);
  });

  it("never fills in a save made with the journal, and takes its goals done from the save alone", () => {
    const game = createGame({ seed: 42 });
    onlyPlayer(game).backpack.contents.plank = 2;
    game.step();
    onlyPlayer(game).backpack.contents.plank = 0;
    game.entities.add({ leanTo: true, position: besidePlayer(game) });
    const save = JSON.parse(JSON.stringify(writeSave(game))) as Record<string, unknown>;

    const loaded = load(save);
    expect(doneGoals(loaded)).toEqual(["cutPlank"]);

    // Once loaded, the lean-to counts as the player doing the goal now, so only that goal is marked, and a notice says so.
    loaded.step();
    expect(doneGoals(loaded)).toEqual(["cutPlank", "buildLeanTo"]);
    expect(justDone(loaded)).toBe("buildLeanTo");
  });

  it("fills in an older save only on its first load, and never again", () => {
    const game = createGame({ seed: 42 });
    game.entities.add({ leanTo: true, position: besidePlayer(game) });
    const filledIn = load(olderSave(game));
    expect(doneGoals(filledIn)).toEqual(["pickUpSticks", "lightCampfire", "fellTree", "buildLeanTo"]);

    // Swap the proof: take the lean-to away and add a sawhorse, which would prove more goals if the check ran again.
    const loadedLeanTo = filledIn.entities.with("leanTo", "position").first;
    if (loadedLeanTo === undefined) throw new Error("No lean-to");
    filledIn.entities.remove(loadedLeanTo);
    filledIn.entities.add({ workStation: "sawhorse", facing: { turns: 0 }, position: besidePlayer(filledIn) });
    const reloaded = load(JSON.parse(JSON.stringify(writeSave(filledIn))));

    expect(doneGoals(reloaded)).toEqual(["pickUpSticks", "lightCampfire", "fellTree", "buildLeanTo"]);
  });

  it("turns away a save whose journal names a goal the game does not know", () => {
    const game = createGame({ seed: 42 });
    const save = JSON.parse(JSON.stringify(writeSave(game))) as Record<string, unknown>;
    save.journal = { done: ["slayDragon"], hidden: false };

    expect(readSave(save)).toEqual({ ok: false, reason: "notASave" });
  });
});

function justDone(game: Game): Goal | null | undefined {
  return game.client.getView().journal?.justDone;
}

function doneGoals(game: Game): readonly Goal[] | undefined {
  return game.client.getView().journal?.done;
}

function onlyPlayer(game: Game): Entity & { backpack: NonNullable<Entity["backpack"]>; position: NonNullable<Entity["position"]> } {
  const player = game.entities.with("player", "backpack", "position").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function besidePlayer(game: Game): { x: number; y: number; z: number } {
  const { x, y, z } = onlyPlayer(game).position;
  return { x: x + 2, y, z };
}

/** Builds a finished room of one foundation square near the player: log walls on all four sides and a roof, but no floor. Returns its middle. */
function roomNearPlayer(game: Game): GroundPoint {
  const { x, z } = onlyPlayer(game).position;
  const square = findPlaceable(game, { x: Math.floor(x) + 0.5, z: Math.floor(z) + 0.5 });
  const deck = foundationDeckTop(game.valley.terrain, square);
  for (const kind of ["foundation", "roof"] as const) {
    game.entities.add({ ...structureOf(kind).finish(square, 0, game.entities), facing: { turns: 0 }, position: { x: square.x, y: deck, z: square.z } });
  }
  for (const side of [0, 1, 2, 3] as const) {
    const edge = edgeMiddle(square, side);
    game.entities.add({ ...structureOf("logWall").finish(edge, side, game.entities), facing: { turns: side }, position: { x: edge.x, y: 0, z: edge.z } });
  }
  return square;
}

function findPlaceable(game: Game, start: GroundPoint): GroundPoint {
  for (let distance = 3; distance < 40; distance += 1) {
    const square = { x: start.x + distance, z: start.z };
    if (game.client.checkPlacement("foundation", square, 0).allowed) return square;
  }
  throw new Error("No open square");
}

function nearest<E extends Entity & { position: { x: number; z: number } }>(game: Game, list: readonly E[]): E {
  const { x, z } = game.client.getView().playerPosition;
  const sorted = [...list].sort((a, b) => Math.hypot(a.position.x - x, a.position.z - z) - Math.hypot(b.position.x - x, b.position.z - z));
  const first = sorted[0];
  if (first === undefined) throw new Error("None found");
  return first;
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
  finishReach(game);
}

function stepUntil(game: Game, done: () => boolean, maxSteps = 100_000): void {
  for (let i = 0; i < maxSteps; i += 1) {
    if (done()) return;
    game.step();
  }
  throw new Error("Never happened");
}

/** The game's save as a save made just before the journal existed: one version older, with no journal. */
function olderSave(game: Game): Record<string, unknown> {
  const save = JSON.parse(JSON.stringify(writeSave(game))) as Record<string, unknown>;
  save.version = JOURNAL_SAVE_VERSION - 1;
  delete save.journal;
  return save;
}

function load(save: unknown): Game {
  const loaded = readSave(save);
  if (!loaded.ok) throw new Error(`The save did not load: ${loaded.reason}`);
  return loaded.game;
}
