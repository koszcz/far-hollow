import { describe, expect, it } from "vitest";
import type { Entity } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { PILES_SAVE_VERSION, readSave, SAVE_VERSION, STICKS_ON_GROUND_SAVE_VERSION, writeSave } from "./save";
import { snapToGridSquare } from "./build-grid";
import { groundDistance, terrainHeightAt } from "./valley";

describe("dropping things from the backpack", () => {
  it("drops all of a kind at the player's feet as one pile", () => {
    const game = createGame({ seed: 42 });
    const player = onlyPlayer(game);
    giveBackpack(game, { bark: 7 });

    send(game, { type: "dropFromBackpack", content: "bark" });

    expect(game.client.getView().backpack.bark ?? 0).toBe(0);
    const piles = pilesOf(game);
    expect(piles).toHaveLength(1);
    expect(piles[0]?.pile).toEqual({ content: "bark", count: 7 });
    expect(piles[0]?.position.x).toBeCloseTo(player.position.x);
    expect(piles[0]?.position.z).toBeCloseTo(player.position.z);
  });

  it("adds things dropped within 1 m of a pile of the same kind to that pile", () => {
    const game = createGame({ seed: 42 });
    const player = onlyPlayer(game);
    giveBackpack(game, { firewood: 3 });
    send(game, { type: "dropFromBackpack", content: "firewood" });

    player.position.x += 0.8;
    giveBackpack(game, { firewood: 2 });
    send(game, { type: "dropFromBackpack", content: "firewood" });

    expect(pileContents(game)).toEqual([{ content: "firewood", count: 5 }]);
  });

  it("starts a new pile further than 1 m away, or for a different kind", () => {
    const game = createGame({ seed: 42 });
    const player = onlyPlayer(game);
    giveBackpack(game, { firewood: 3, bark: 2 });
    send(game, { type: "dropFromBackpack", content: "firewood" });
    send(game, { type: "dropFromBackpack", content: "bark" });

    player.position.x += 1.5;
    giveBackpack(game, { firewood: 2 });
    send(game, { type: "dropFromBackpack", content: "firewood" });

    expect(pileContents(game)).toEqual(sortedPiles([
      { content: "firewood", count: 3 },
      { content: "bark", count: 2 },
      { content: "firewood", count: 2 },
    ]));
  });

  it("lays a pile dropped on a foundation on its deck, not on the ground under it", () => {
    const game = createGame({ seed: 42 });
    const player = onlyPlayer(game);
    const square = snapToGridSquare(player.position);
    const deckTop = terrainHeightAt(game.valley.terrain, square.x, square.z) + 0.6;
    game.entities.add({ foundation: true, position: { x: square.x, y: deckTop, z: square.z } });
    giveBackpack(game, { firewood: 2, stick: 2 });

    send(game, { type: "dropFromBackpack", content: "firewood" });
    send(game, { type: "dropFromBackpack", content: "stick" });

    expect(onlyPile(game).position.y).toBeCloseTo(deckTop, 5);
    const onDeck = sticksOf(game).filter((stick) => groundDistance(stick.position, square) < 0.4);
    expect(onDeck.length).toBeGreaterThan(0);
    for (const stick of onDeck) expect(stick.position.y).toBeCloseTo(deckTop, 5);
  });

  it("does nothing when the backpack holds none of that kind", () => {
    const game = createGame({ seed: 42 });
    send(game, { type: "dropFromBackpack", content: "firewood" });
    expect(pilesOf(game)).toHaveLength(0);
  });

  it("drops tools, food, the bedroll, and a pot of boiled water, which stays boiled", () => {
    const game = createGame({ seed: 42 });
    const player = onlyPlayer(game);
    const backpack = player.backpack;
    if (backpack === undefined) throw new Error("No backpack");
    delete backpack.contents.pot;
    giveBackpack(game, { potOfBoiledWater: 1, berries: 4 });
    for (const content of ["axe", "berries", "bedroll", "potOfBoiledWater"] as const) {
      send(game, { type: "dropFromBackpack", content });
    }

    expect(pileContents(game)).toEqual(sortedPiles([
      { content: "axe", count: 1 },
      { content: "berries", count: 4 },
      { content: "bedroll", count: 1 },
      { content: "potOfBoiledWater", count: 1 },
    ]));
    const left = Object.entries(game.client.getView().backpack).filter(([, count]) => count > 0);
    expect(Object.fromEntries(left)).toEqual({ knife: 1, drawknife: 1, fireStriker: 1, sawBlade: 1 });
  });

  it("leaves a dropped bedroll rolled up, so the player cannot sleep in it, and laying the bedroll still works", () => {
    const game = createGame({ seed: 42 });
    send(game, { type: "dropFromBackpack", content: "bedroll" });
    expect(game.entities.with("bedroll").size).toBe(0);
    expect(game.client.getView().nearbyBedroll).toBeNull();

    giveBackpack(game, { bedroll: 1 });
    send(game, { type: "layBedroll" });
    expect(game.entities.with("bedroll").size).toBe(1);
  });

  it("never piles logs: dropping the log on the shoulder lays it on the ground as before", () => {
    const game = createGame({ seed: 42 });
    const player = onlyPlayer(game);
    game.entities.addComponent(player, "carrying", "log");
    send(game, { type: "dropLog" });
    player.carrying = "debarkedLog";
    send(game, { type: "dropLog" });

    expect(game.entities.with("log").size).toBe(1);
    expect(game.entities.with("debarkedLog").size).toBe(1);
    expect(pilesOf(game)).toHaveLength(0);
  });

  it("leaves piles where they lie, through days of rain", () => {
    const game = createGame({ seed: 42 });
    giveBackpack(game, { bark: 4, berries: 2 });
    send(game, { type: "dropFromBackpack", content: "bark" });
    send(game, { type: "dropFromBackpack", content: "berries" });
    const before = structuredClone(pilesOf(game));

    for (let i = 0; i < 6; i += 1) send(game, { type: "skipToRainChange" });
    send(game, { type: "skipTime", hours: 72 });

    expect(pilesOf(game)).toEqual(before);
  });
});

describe("dropping sticks", () => {
  it("lays dropped sticks on the ground one by one, as normal sticks like those on the forest floor", () => {
    const game = createGame({ seed: 42 });
    const player = onlyPlayer(game);
    const before = new Set(sticksOf(game));
    giveBackpack(game, { stick: 7 });

    send(game, { type: "dropFromBackpack", content: "stick" });

    expect(game.client.getView().backpack.stick ?? 0).toBe(0);
    expect(pilesOf(game)).toHaveLength(0);
    const dropped = sticksOf(game).filter((stick) => !before.has(stick));
    expect(dropped).toHaveLength(7);
    for (const stick of dropped) {
      expect(Object.keys(stick).sort()).toEqual(["position", "stick"]);
      expect(groundDistance(stick.position, player.position)).toBeLessThanOrEqual(1);
    }
  });

  it("picks up a dropped stick the same way as a stick on the forest floor", () => {
    const game = createGame({ seed: 42 });
    const before = new Set(sticksOf(game));
    giveBackpack(game, { stick: 3 });
    send(game, { type: "dropFromBackpack", content: "stick" });
    const stick = sticksOf(game).find((candidate) => !before.has(candidate));
    if (stick === undefined) throw new Error("No dropped stick");
    walkAway(game);

    send(game, { type: "pickUpStick", stickId: idOf(game, stick) });
    stepUntil(game, () => !game.entities.has(stick));

    expect(game.client.getView().backpack.stick).toBe(1);
  });

  it("turns a pile of sticks in an older save into normal sticks on the ground", () => {
    const game = createGame({ seed: 42 });
    const stickCount = sticksOf(game).length;
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { version: number; entities: { id: number; components: Record<string, unknown> }[] };
    const player = onlyPlayer(game);
    save.version = STICKS_ON_GROUND_SAVE_VERSION - 1;
    save.entities.push({ id: Math.max(...save.entities.map((entity) => entity.id)) + 1, components: { pile: { content: "stick", count: 4 }, position: { ...player.position } } });

    const loaded = readSave(save);
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(pilesOf(loaded.game)).toHaveLength(0);
    const sticks = sticksOf(loaded.game);
    expect(sticks).toHaveLength(stickCount + 4);
    expect(sticks.filter((stick) => groundDistance(stick.position, player.position) <= 1).length).toBeGreaterThanOrEqual(4);
  });
});

describe("picking up piles", () => {
  it("walks the player to a pile and puts all of it in the backpack", () => {
    const game = createGame({ seed: 42 });
    giveBackpack(game, { firewood: 4 });
    send(game, { type: "dropFromBackpack", content: "firewood" });
    const pile = onlyPile(game);
    walkAway(game);

    send(game, { type: "pickUpPile", pileId: idOf(game, pile) });
    stepUntil(game, () => !game.entities.has(pile));

    expect(game.client.getView().backpack.firewood).toBe(4);
    expect(groundDistance(onlyPlayer(game).position, pile.position)).toBeLessThan(2);
  });

  it("takes as many as fit in the backpack and leaves the rest in the pile", () => {
    const game = createGame({ seed: 42 });
    giveBackpack(game, { firewood: 10 });
    send(game, { type: "dropFromBackpack", content: "firewood" });
    const pile = onlyPile(game);
    walkAway(game);
    // The starting things weigh 5.4 kg, so with 8.4 kg of bark only 4 pieces of firewood (6 kg) fit under 20 kg.
    giveBackpack(game, { bark: 28 });

    send(game, { type: "pickUpPile", pileId: idOf(game, pile) });
    stepUntil(game, () => (game.client.getView().backpack.firewood ?? 0) > 0);

    expect(game.client.getView().backpack.firewood).toBe(4);
    expect(pile.pile).toEqual({ content: "firewood", count: 6 });
    expect(game.entities.has(pile)).toBe(true);
  });

  it("tells the player the backpack is full when none of the pile fits, and leaves it be", () => {
    const game = createGame({ seed: 42 });
    giveBackpack(game, { firewood: 2 });
    send(game, { type: "dropFromBackpack", content: "firewood" });
    const pile = onlyPile(game);
    giveBackpack(game, { bark: 50 });

    send(game, { type: "pickUpPile", pileId: idOf(game, pile) });
    expect(game.client.getView().notice?.kind).toBe("backpackFull");
    runSeconds(game, 5);

    expect(pile.pile).toEqual({ content: "firewood", count: 2 });
  });

  it("puts a dropped pot of boiled water back as a pot of boiled water", () => {
    const game = createGame({ seed: 42 });
    const backpack = onlyPlayer(game).backpack;
    if (backpack === undefined) throw new Error("No backpack");
    delete backpack.contents.pot;
    giveBackpack(game, { potOfBoiledWater: 1 });
    send(game, { type: "dropFromBackpack", content: "potOfBoiledWater" });
    const pile = onlyPile(game);

    send(game, { type: "pickUpPile", pileId: idOf(game, pile) });
    stepUntil(game, () => !game.entities.has(pile));

    expect(game.client.getView().backpack.potOfBoiledWater).toBe(1);
    expect(game.client.getView().backpack.pot).toBeUndefined();
  });
});

describe("seeing a pile", () => {
  it("shows the pile within the player's reach and how many things it holds", () => {
    const game = createGame({ seed: 42 });
    expect(game.client.getView().nearbyPile).toBeNull();
    giveBackpack(game, { bark: 7 });
    send(game, { type: "dropFromBackpack", content: "bark" });

    expect(game.client.getView().nearbyPile).toEqual({ id: idOf(game, onlyPile(game)), content: "bark", count: 7 });
    walkAway(game);
    expect(game.client.getView().nearbyPile).toBeNull();
  });
});

describe("saving piles", () => {
  it("restores piles, and a walk to pick one up, exactly", () => {
    const game = createGame({ seed: 42 });
    giveBackpack(game, { bark: 5, potOfBoiledWater: 1 });
    send(game, { type: "dropFromBackpack", content: "bark" });
    send(game, { type: "dropFromBackpack", content: "potOfBoiledWater" });
    walkAway(game);
    const barkPile = pilesOf(game).find((pile) => pile.pile.content === "bark");
    if (barkPile === undefined) throw new Error("No bark pile");
    send(game, { type: "pickUpPile", pileId: idOf(game, barkPile) });

    const saved = writeSave(game);
    const loaded = readSave(JSON.parse(JSON.stringify(saved)));
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(writeSave(loaded.game)).toEqual(saved);
    expect(pileContents(loaded.game)).toEqual(sortedPiles([{ content: "bark", count: 5 }, { content: "potOfBoiledWater", count: 1 }]));
    stepUntil(loaded.game, () => loaded.game.client.getView().backpack.bark === 5);
  });

  it("turns away a save with a broken pile", () => {
    const game = createGame({ seed: 42 });
    giveBackpack(game, { bark: 5 });
    send(game, { type: "dropFromBackpack", content: "bark" });
    const saved = JSON.parse(JSON.stringify(writeSave(game))) as { entities: { components: Record<string, unknown> }[] };
    const pile = saved.entities.find((entity) => entity.components.pile !== undefined);
    if (pile === undefined) throw new Error("No pile saved");

    pile.components.pile = { content: "bark", count: 0 };
    expect(readSave(saved).ok).toBe(false);
    pile.components.pile = { content: "log", count: 1 };
    expect(readSave(saved).ok).toBe(false);
  });

  it("upgrades a save from before piles existed", () => {
    const game = createGame({ seed: 42 });
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { version: number };
    save.version = PILES_SAVE_VERSION - 1;

    const loaded = readSave(save);
    if (!loaded.ok) throw new Error("The save was rejected");
    expect(writeSave(loaded.game).version).toBe(SAVE_VERSION);
    expect(pilesOf(loaded.game)).toHaveLength(0);
  });
});

function onlyPile(game: Game) {
  const [pile, ...others] = pilesOf(game);
  if (pile === undefined || others.length > 0) throw new Error("Expected exactly one pile");
  return pile;
}

/** Walks the player about 6 m from where they stand. */
function walkAway(game: Game): void {
  const { x, z } = onlyPlayer(game).position;
  send(game, { type: "walkTo", x: x + 6, z });
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
  expect(groundDistance(onlyPlayer(game).position, { x, z })).toBeGreaterThan(3);
}

function stepUntil(game: Game, done: () => boolean, maxSteps = 100_000): void {
  for (let i = 0; i < maxSteps; i += 1) {
    if (done()) return;
    game.step();
  }
  throw new Error("Never happened");
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}

function send(game: Game, command: Parameters<Game["client"]["send"]>[0]): void {
  game.client.send(command);
  game.step();
}

function sticksOf(game: Game) {
  return [...game.entities.with("stick", "position")];
}

function pilesOf(game: Game) {
  return [...game.entities.with("pile", "position")];
}

type PileContents = NonNullable<Entity["pile"]>;

/** Piles in a fixed order, since the store does not keep them in the order they were made. */
function sortedPiles(piles: PileContents[]): PileContents[] {
  return [...piles].sort((a, b) => a.content.localeCompare(b.content) || a.count - b.count);
}

/** What each pile in the valley holds, in a fixed order. */
function pileContents(game: Game): PileContents[] {
  return sortedPiles(pilesOf(game).map((pile) => ({ ...pile.pile })));
}

function giveBackpack(game: Game, contents: NonNullable<Entity["backpack"]>["contents"]): void {
  const backpack = onlyPlayer(game).backpack;
  if (backpack === undefined) throw new Error("No backpack");
  Object.assign(backpack.contents, contents);
}

function runSeconds(game: Game, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * STEPS_PER_SECOND); i += 1) game.step();
}

function onlyPlayer(game: Game) {
  const player = game.entities.with("player", "position").first;
  if (player === undefined) throw new Error("No player");
  return player;
}
