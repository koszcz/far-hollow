import { describe, expect, it } from "bun:test";
import type { Command } from "./api";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";

describe("warmth", () => {
  it("starts full and holds steady through the day", () => {
    const game = createGame({ seed: 42 });
    expect(game.client.getView().warmth).toBe(1);
    runGameMinutes(game, 30);
    expect(game.client.getView().warmth).toBe(1);
  });

  it("drains at night away from a lit campfire", () => {
    const game = createGame({ seed: 42 });
    send(game, { type: "skipTime", hours: 12 }); // 20:00, night starts.
    runGameMinutes(game, 60);
    expect(game.client.getView().warmth).toBeLessThan(0.9);
    expect(game.client.getView().warmth).toBeGreaterThan(0.6);
  });

  it("does not drain at night beside a lit campfire, and recovers there", () => {
    const game = createGame({ seed: 42 });
    send(game, { type: "skipTime", hours: 14 }); // 22:00, two hours into the night.
    const chilled = game.client.getView().warmth;
    expect(chilled).toBeLessThan(0.6);

    putCampfireBesidePlayer(game, { lit: true });
    runGameMinutes(game, 30);

    expect(game.client.getView().warmth).toBeGreaterThan(chilled + 0.2);
  });

  it("does not recover beside a campfire that is not lit", () => {
    const game = createGame({ seed: 42 });
    send(game, { type: "skipTime", hours: 14 });
    const chilled = game.client.getView().warmth;

    putCampfireBesidePlayer(game, { lit: false });
    runGameMinutes(game, 30);

    expect(game.client.getView().warmth).toBeLessThan(chilled);
  });

  it("slows the player's walking when warmth is low", () => {
    const warm = createGame({ seed: 42 });
    const cold = createGame({ seed: 42 });
    send(cold, { type: "skipTime", hours: 16 }); // Midnight: four hours of night have drained all warmth.
    expect(cold.client.getView().warmth).toBe(0);

    const warmDistance = distanceWalkedInOneSecond(warm);
    const coldDistance = distanceWalkedInOneSecond(cold);

    expect(warmDistance).toBeGreaterThan(2);
    expect(coldDistance).toBeLessThan(warmDistance * 0.6);
  });

  it("slows the player's actions when warmth is low", () => {
    const warm = createGame({ seed: 42 });
    const cold = createGame({ seed: 42 });
    send(cold, { type: "skipTime", hours: 16 });

    const warmProgress = chopProgressAfterOneSecond(warm);
    const coldProgress = chopProgressAfterOneSecond(cold);

    expect(warmProgress).toBeGreaterThan(0);
    expect(coldProgress).toBeLessThan(warmProgress * 0.6);
  });

  it("does not slow the player while warmth is still fairly high", () => {
    const warm = createGame({ seed: 42 });
    const cool = createGame({ seed: 42 });
    send(cool, { type: "skipTime", hours: 13 }); // 21:00: one hour of night.

    expect(distanceWalkedInOneSecond(cool)).toBeCloseTo(distanceWalkedInOneSecond(warm), 5);
  });
});

describe("a collapse from the cold", () => {
  it("does not happen after only a short while with no warmth", () => {
    const game = createGame({ seed: 42 });
    send(game, { type: "skipTime", hours: 16.5 }); // 00:30: half an hour with no warmth.

    expect(game.client.getView().time).toMatchObject({ day: 2, hour: 0, minute: 30 });
    expect(game.client.getView().notice).toBeNull();
  });

  it("happens after a long while with no warmth, and the player wakes where they started the next morning", () => {
    const game = createGame({ seed: 42 });
    const player = onlyPlayer(game);
    const start = { ...player.position };
    const backpack = { ...game.client.getView().backpack };
    walkTo(game, { x: start.x - 20, z: start.z });
    expect(Math.hypot(player.position.x - start.x, player.position.z - start.z)).toBeGreaterThan(10);

    send(game, { type: "skipTime", hours: 16 }); // Midnight: no warmth left.
    for (let minutes = 0; game.client.getView().notice === null; minutes += 1) {
      if (minutes > 70) throw new Error("No collapse after 70 minutes with no warmth");
      runGameMinutes(game, 1);
    }

    const view = game.client.getView();
    expect(view.notice?.kind).toBe("collapsed");
    expect(view.time).toMatchObject({ day: 2, hour: 6, minute: 0 });
    expect(view.playerPosition.x).toBeCloseTo(start.x, 5);
    expect(view.playerPosition.z).toBeCloseTo(start.z, 5);
    expect(player.walkPath).toBeUndefined();
    expect(view.warmth).toBeGreaterThan(0);
    expect(view.warmth).toBeLessThan(0.3);
    expect(view.backpack).toEqual(backpack);
  });

  it("interrupts skipped time", () => {
    const game = createGame({ seed: 42 });
    send(game, { type: "skipTime", hours: 40 }); // Would reach 00:00 on day 3.

    expect(game.client.getView().notice?.kind).toBe("collapsed");
    expect(game.client.getView().time).toMatchObject({ day: 2, hour: 6, minute: 0 });
  });

  it("leaves a log the player carried on the ground where they fell", () => {
    const game = createGame({ seed: 42 });
    const player = onlyPlayer(game);
    game.entities.addComponent(player, "carrying", "log");
    const fellAt = { ...player.position };
    const logsBefore = game.entities.with("log", "position").entities.length;

    send(game, { type: "skipTime", hours: 18 });

    expect(game.client.getView().notice?.kind).toBe("collapsed");
    expect(game.client.getView().carrying).toBeNull();
    const logs = game.entities.with("log", "position").entities;
    expect(logs).toHaveLength(logsBefore + 1);
    expect(logs.at(-1)?.position.x).toBeCloseTo(fellAt.x, 5);
  });
});

describe("surviving the first night", () => {
  it("shows a message on reaching the first morning without a collapse, for a short while", () => {
    const game = createGame({ seed: 42 });
    putCampfireBesidePlayer(game, { lit: true, fuelMinutes: 24 * 60 });

    send(game, { type: "skipTime", hours: 21.5 }); // 05:30 on day 2.
    expect(game.client.getView().notice).toBeNull();
    runGameMinutes(game, 31);
    expect(game.client.getView().notice?.kind).toBe("survivedFirstNight");

    runGameMinutes(game, 31);
    expect(game.client.getView().notice).toBeNull();
  });

  it("does not show the message after a collapse that night", () => {
    const game = createGame({ seed: 42 });

    send(game, { type: "skipTime", hours: 20 }); // Collapses at about 01:00, then wakes at 06:00.
    expect(game.client.getView().notice?.kind).toBe("collapsed");
    runGameMinutes(game, 40);

    expect(game.client.getView().notice).toBeNull();
  });

  it("does not show the message on later mornings", () => {
    const game = createGame({ seed: 42 });
    putCampfireBesidePlayer(game, { lit: true, fuelMinutes: 48 * 60 });

    send(game, { type: "skipTime", hours: 23 }); // 07:00 on day 2.
    quenchThirst(game); // So thirst does not cause a collapse during the second skip.
    // Two days awake would also end in a collapse from fatigue, so the player is rested in between.
    const needs = onlyPlayer(game).needs;
    if (needs !== undefined) needs.fatigue.level = 1;
    send(game, { type: "skipTime", hours: 23 }); // 06:00 on day 3.

    expect(game.client.getView().notice).toBeNull();
  });
});

function walkTo(game: Game, to: { x: number; z: number }): void {
  send(game, { type: "walkTo", x: to.x, z: to.z });
  for (let i = 0; onlyPlayer(game).walkPath !== undefined; i += 1) {
    if (i > 100_000) throw new Error("Never arrived");
    game.step();
  }
}

/** Sends the player walking away from the river and returns how far they got in one real second. */
function distanceWalkedInOneSecond(game: Game): number {
  const player = onlyPlayer(game);
  const start = { ...player.position };
  send(game, { type: "walkTo", x: start.x - 30, z: start.z });
  const afterFirstStep = { ...player.position };
  for (let i = 0; i < STEPS_PER_SECOND; i += 1) game.step();
  return Math.hypot(player.position.x - afterFirstStep.x, player.position.z - afterFirstStep.z);
}

/** Sends the player to chop the nearest tree and returns how far along the chopping is one real second after it starts. */
function chopProgressAfterOneSecond(game: Game): number {
  const player = onlyPlayer(game);
  let nearest: { id: number; distance: number } | undefined;
  for (const tree of game.entities.with("tree", "position")) {
    const distance = Math.hypot(tree.position.x - player.position.x, tree.position.z - player.position.z);
    const id = game.entities.id(tree);
    if (id !== undefined && (nearest === undefined || distance < nearest.distance)) nearest = { id, distance };
  }
  if (nearest === undefined) throw new Error("No tree");
  send(game, { type: "chopTree", treeId: nearest.id });
  for (let i = 0; game.client.getView().action?.kind !== "chop"; i += 1) {
    if (i > 100_000) throw new Error("Never started chopping");
    game.step();
  }
  const before = game.client.getView().action?.progress ?? 0;
  for (let i = 0; i < STEPS_PER_SECOND; i += 1) game.step();
  return (game.client.getView().action?.progress ?? 0) - before;
}

/** Puts a campfire with plenty of fuel 2 m from the player, inside its warmth range. */
function putCampfireBesidePlayer(game: Game, { lit, fuelMinutes = 8 * 60 }: { lit: boolean; fuelMinutes?: number }) {
  const player = onlyPlayer(game);
  return game.entities.add({
    campfire: { lit, fuelMinutes },
    position: { x: player.position.x + 2, y: player.position.y, z: player.position.z },
  });
}

/** Fills the player's thirst, as if they had drunk safe water. */
function quenchThirst(game: Game): void {
  const player = game.entities.with("player", "needs").first;
  if (player === undefined) throw new Error("No player");
  player.needs.thirst.level = 1;
}

function onlyPlayer(game: Game) {
  const player = game.entities.with("player", "position").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
}

/** Runs logic steps for this many game minutes. One game minute passes in one real second. */
function runGameMinutes(game: Game, minutes: number): void {
  for (let i = 0; i < minutes * STEPS_PER_SECOND; i += 1) game.step();
}
