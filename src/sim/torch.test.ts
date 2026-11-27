import { describe, expect, it } from "bun:test";
import type { Command } from "./api";
import type { BackpackContents } from "./backpack";
import { CONTENT_WEIGHT_KG } from "./backpack";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import type { Entity } from "./entities";
import { groundDistance, type GroundPoint } from "./ground-point";
import { readSave, writeSave } from "./save";
import { SAVE_VERSION } from "./save-upgrades";
import { FIREPLACES_SAVE_VERSION, TORCHES_SAVE_VERSION } from "./save-versions";
import { finishReach } from "./test-steps";
import { isWalkable } from "./walk-map";

describe("the torch in the craft menu", () => {
  it("is a hand recipe that uses 1 stick and 1 bark and needs no tool", () => {
    const torch = createGame({ seed: 42 })
      .client.getView()
      .craftMenu.find(({ kind }) => kind === "torch");

    expect(torch).toMatchObject({
      materials: [
        { material: "stick", count: 1 },
        { material: "bark", count: 1 },
      ],
      result: { content: "torch", count: 1 },
    });
    expect(torch?.tool).toBeUndefined();
    expect(torch?.station).toBeUndefined();
  });
});

describe("crafting a torch", () => {
  it("turns a stick and a piece of bark into one torch, which weighs 0.8 kg", () => {
    const game = createGame({ seed: 42 });
    give(game, { stick: 2, bark: 1 });
    game.step();
    const weightBefore = game.client.getView().backpackWeight;

    send(game, { type: "craft", recipe: "torch" });
    stepUntil(game, () => game.client.getView().action === null);

    expect(game.client.getView().backpack).toMatchObject({ stick: 1, torch: 1 });
    expect(game.client.getView().backpack.bark ?? 0).toBe(0);
    expect(CONTENT_WEIGHT_KG.torch).toBe(0.8);
    expect(game.client.getView().backpackWeight).toBeCloseTo(weightBefore - 0.5 - 0.3 + 0.8, 5);
  });
});

describe("lighting a torch", () => {
  it("without the steel and flint is refused, saying the steel and flint is needed", () => {
    const game = createGame({ seed: 42 });
    onlyPlayer(game).backpack.contents = { torch: 1 };

    expect(game.client.refusal({ type: "lightTorch" })).toEqual({ kind: "needsTool", tool: "steelAndFlint" });
    send(game, { type: "lightTorch" });
    expect(game.client.getView().litTorch).toBeNull();
    expect(game.client.getView().backpack.torch).toBe(1);
  });

  it("takes one torch out of the backpack and puts it in the player's hand, lit for 3 game hours", () => {
    const game = createGame({ seed: 42 });
    give(game, { torch: 2 });

    expect(game.client.refusal({ type: "lightTorch" })).toBeNull();
    send(game, { type: "lightTorch" });

    const view = game.client.getView();
    expect(view.backpack.torch).toBe(1);
    expect(view.litTorch?.minutesLeft).toBeCloseTo(180, 0);
  });

  it("is refused while the player already holds a lit torch, and leaves the second torch in the backpack", () => {
    const game = createGame({ seed: 42 });
    give(game, { torch: 2 });
    send(game, { type: "lightTorch" });

    expect(game.client.refusal({ type: "lightTorch" })).toEqual({ kind: "torchAlreadyLit" });
    send(game, { type: "lightTorch" });
    expect(game.client.getView().backpack.torch).toBe(1);
  });
});

describe("a lit torch burning", () => {
  it("burns down with game time and is gone after 3 game hours", () => {
    const game = createGame({ seed: 42 });
    give(game, { torch: 1 });
    send(game, { type: "lightTorch" });

    send(game, { type: "skipTime", hours: 1.5 });
    expect(game.client.getView().litTorch?.minutesLeft).toBeCloseTo(90, 0);

    send(game, { type: "skipTime", hours: 1.4 });
    expect(game.client.getView().litTorch).not.toBeNull();
    send(game, { type: "skipTime", hours: 0.2 });
    expect(game.client.getView().litTorch).toBeNull();
    expect(game.client.getView().backpack.torch ?? 0).toBe(0);
  });

  it("burns just as long in the rain", () => {
    const dry = createGame({ seed: 42 });
    const wet = createGame({ seed: 42 });
    for (const game of [dry, wet]) {
      give(game, { torch: 1 });
      send(game, { type: "lightTorch" });
    }
    const rain = wet.entities.with("rain").first?.rain;
    if (rain === undefined) throw new Error("No rain");
    Object.assign(rain, { falling: true, changeAtMinutes: Number.MAX_SAFE_INTEGER });

    runSeconds(dry, 30);
    runSeconds(wet, 30);

    expect(wet.client.getView().raining).toBe(true);
    expect(wet.client.getView().litTorch?.minutesLeft).toBe(dry.client.getView().litTorch?.minutesLeft);
  });

  it("gives no warmth", () => {
    const without = createGame({ seed: 42 });
    const withTorch = createGame({ seed: 42 });
    // 22:00, when the night chills the player.
    for (const game of [without, withTorch]) send(game, { type: "skipTime", hours: 14 });
    give(withTorch, { torch: 1 });
    give(without, { torch: 1 });
    send(withTorch, { type: "lightTorch" });
    without.step();
    for (const game of [without, withTorch]) send(game, { type: "skipTime", hours: 1 });

    expect(withTorch.client.getView().litTorch).not.toBeNull();
    expect(withTorch.client.getView().warmth).toBeLessThan(1);
    expect(withTorch.client.getView().warmth).toBe(without.client.getView().warmth);
  });
});

describe("putting out a torch", () => {
  it("throws the lit torch away, and no unlit torch goes back in the backpack", () => {
    const game = createGame({ seed: 42 });
    give(game, { torch: 2 });
    send(game, { type: "lightTorch" });

    send(game, { type: "putOutTorch" });

    expect(game.client.getView().litTorch).toBeNull();
    expect(game.client.getView().backpack.torch).toBe(1);
  });

  it("lets the player light the next torch", () => {
    const game = createGame({ seed: 42 });
    give(game, { torch: 2 });
    send(game, { type: "lightTorch" });
    send(game, { type: "putOutTorch" });

    send(game, { type: "lightTorch" });

    expect(game.client.getView().litTorch).not.toBeNull();
    expect(game.client.getView().backpack.torch ?? 0).toBe(0);
  });
});

describe("sleeping with a lit torch", () => {
  it("on a bedroll puts the torch out, and it is gone", () => {
    const game = createGame({ seed: 42 });
    give(game, { torch: 1 });
    send(game, { type: "lightTorch" });
    send(game, { type: "layBedroll" });
    const bedroll = game.entities.with("bedroll").first;
    if (bedroll === undefined) throw new Error("No bedroll");

    send(game, { type: "sleep", bedrollId: idOf(game, bedroll) });
    stepUntil(game, () => game.client.getView().lastSleep !== null);

    expect(game.client.getView().litTorch).toBeNull();
    expect(game.client.getView().backpack.torch ?? 0).toBe(0);
  });

  it("in a bed puts the torch out, and it is gone", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const bedId = buildNearPlayer(game, "bed");
    give(game, { torch: 1 });
    send(game, { type: "lightTorch" });

    send(game, { type: "sleepInBed", bedId });
    stepUntil(game, () => game.client.getView().lastSleep !== null);

    expect(game.client.getView().litTorch).toBeNull();
    expect(game.client.getView().backpack.torch ?? 0).toBe(0);
  });

  it("after a collapse puts the torch out, even when it would still burn at morning", () => {
    const game = createGame({ seed: 42 });
    // Skip to 5:00 on day 2 an hour at a time, keeping every need full, so the player does not collapse on the way.
    for (let hour = 0; hour < 21; hour += 1) {
      fillNeeds(game);
      send(game, { type: "skipTime", hours: 1 });
    }
    expect(game.client.getView().time).toMatchObject({ day: 2, hour: 5 });
    fillNeeds(game);
    give(game, { torch: 1 });
    send(game, { type: "lightTorch" });

    // An hour without food is a collapse. The player wakes at 6:00, before the torch would burn out.
    Object.assign(onlyPlayer(game).needs.hunger, { level: 0, minutesWithout: 59 });
    send(game, { type: "skipTime", hours: 0.1 });

    expect(game.client.getView().notice?.kind).toBe("collapsed");
    expect(game.client.getView().litTorch).toBeNull();
    expect(game.client.getView().backpack.torch ?? 0).toBe(0);
  });
});

/** Sets every need of the player to full. */
function fillNeeds(game: Game): void {
  for (const need of Object.values(onlyPlayer(game).needs)) Object.assign(need, { level: 1, minutesWithout: 0 });
}

describe("keeping a lit torch", () => {
  it("stays lit in the player's hand while they walk, chop, carry a log, and drag a sled", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const sledId = buildNearPlayer(game, "sled");
    give(game, { torch: 1 });
    send(game, { type: "lightTorch" });
    const lit = () => game.client.getView().litTorch !== null;

    const { position } = onlyPlayer(game);
    send(game, { type: "walkTo", x: position.x + 3, z: position.z });
    stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
    expect(lit()).toBe(true);

    send(game, { type: "chopTree", treeId: idOf(game, nearestTree(game)) });
    stepUntil(game, () => game.entities.with("log").size > 0);
    expect(lit()).toBe(true);

    const log = game.entities.with("log").first;
    if (log === undefined) throw new Error("No log");
    send(game, { type: "pickUpLog", logId: idOf(game, log) });
    stepUntil(game, () => game.client.getView().carrying !== null);
    expect(lit()).toBe(true);
    send(game, { type: "dropLog" });
    finishReach(game);

    send(game, { type: "dragSled", sledId });
    stepUntil(game, () => game.client.getView().dragging !== null);
    const at = onlyPlayer(game).position;
    send(game, { type: "walkTo", x: at.x + 2, z: at.z });
    runSeconds(game, 2);
    expect(game.client.getView().dragging).not.toBeNull();
    expect(lit()).toBe(true);
  });
});

describe("saving a torch", () => {
  it("keeps unlit torches in the backpack, and the lit torch with its burning time left", () => {
    const game = createGame({ seed: 42 });
    give(game, { torch: 3 });
    send(game, { type: "lightTorch" });
    send(game, { type: "skipTime", hours: 1 });
    const minutesLeft = game.client.getView().litTorch?.minutesLeft ?? -1;

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save did not load");
    loaded.game.step();

    expect(loaded.game.client.getView().backpack.torch).toBe(2);
    expect(loaded.game.client.getView().litTorch?.minutesLeft).toBeCloseTo(minutesLeft, 0);
  });

  it("raises the save version for torches, and loads a save from before then", () => {
    expect(TORCHES_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    expect(TORCHES_SAVE_VERSION).toBeGreaterThan(FIREPLACES_SAVE_VERSION);
    const save = JSON.parse(JSON.stringify(writeSave(createGame({ seed: 42 })))) as { version: number };
    save.version = TORCHES_SAVE_VERSION - 1;

    const loaded = readSave(save);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.game.client.getView().litTorch).toBeNull();
  });
});

/** Places a blueprint of a bed or sled on open ground near the player, builds it in the playground, and returns its entity id. */
function buildNearPlayer(game: Game, structure: "bed" | "sled"): number {
  const square = openSquareNearPlayer(game);
  send(game, { type: "placeBlueprint", structure, turns: 0, x: square.x, z: square.z });
  const blueprint = game.entities.with("blueprint", "position").first;
  if (blueprint === undefined) throw new Error("No blueprint");
  const id = idOf(game, blueprint);
  send(game, { type: "build", blueprintId: id });
  stepUntil(game, () => game.entities.entity(id)?.blueprint === undefined);
  return id;
}

/** The middle of a building-grid square a few metres west of the player, with open ground all round it. */
function openSquareNearPlayer(game: Game): GroundPoint {
  const { position } = onlyPlayer(game);
  for (let distance = 3; distance < 30; distance += 1) {
    const square = { x: Math.floor(position.x - distance) + 0.5, z: Math.floor(position.z) + 0.5 };
    const open = [-2, -1, 0, 1, 2].every((ax) => [-2, -1, 0, 1, 2].every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })));
    if (open) return square;
  }
  throw new Error("No open square");
}

/** The standing tree nearest the player. */
function nearestTree(game: Game) {
  const { position } = onlyPlayer(game);
  const trees = game.entities.with("tree", "position").entities;
  const tree = [...trees].sort((a, b) => groundDistance(a.position, position) - groundDistance(b.position, position))[0];
  if (tree === undefined) throw new Error("No tree");
  return tree;
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}

/** Puts more of each kind in the backpack. */
function give(game: Game, contents: BackpackContents): void {
  const { backpack } = onlyPlayer(game);
  for (const [content, count] of Object.entries(contents) as [keyof BackpackContents, number][]) {
    backpack.contents = { ...backpack.contents, [content]: (backpack.contents[content] ?? 0) + count };
  }
}

function stepUntil(game: Game, done: () => boolean): void {
  for (let i = 0; !done(); i += 1) {
    if (i > 1_000_000) throw new Error("It never happened");
    game.step();
  }
}

function runSeconds(game: Game, seconds: number): void {
  for (let i = 0; i < seconds * STEPS_PER_SECOND; i += 1) game.step();
}

function onlyPlayer(game: Game) {
  const player = game.entities.with("player", "position", "needs", "backpack").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
  finishReach(game);
}

void runSeconds;
