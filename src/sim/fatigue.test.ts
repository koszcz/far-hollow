import { describe, expect, it } from "vitest";
import type { Command } from "./api";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { createNeeds, needsSpeed } from "./needs";
import { readSave, SAVE_VERSION, upgradeSave, writeSave } from "./save";

describe("fatigue", () => {
  it("drains while the player is awake", () => {
    const game = createGame({ seed: 42 });
    send(game, { type: "skipTime", hours: 6 }); // 14:00.

    const fatigue = game.client.getView().needs.fatigue;
    expect(fatigue).toBeLessThan(0.9);
    expect(fatigue).toBeGreaterThan(0.5);
  });

  it("drains faster during timed work such as chopping", () => {
    const idle = createGame({ seed: 42 });
    const working = createGame({ seed: 42 });
    startChoppingNearestTree(working);
    const workingBefore = working.client.getView().needs.fatigue;
    const idleBefore = idle.client.getView().needs.fatigue;

    // Chopping a tree takes a few seconds. Let both games run for as long as it lasts.
    let steps = 0;
    for (; working.client.getView().action !== null; steps += 1) working.step();
    for (let i = 0; i < steps; i += 1) idle.step();
    expect(steps).toBeGreaterThan(STEPS_PER_SECOND);

    const idleLoss = idleBefore - idle.client.getView().needs.fatigue;
    const workingLoss = workingBefore - working.client.getView().needs.fatigue;
    expect(idleLoss).toBeGreaterThan(0);
    expect(workingLoss).toBeGreaterThan(idleLoss * 1.5);
  });

  it("slows the player when it is low, like the other needs", () => {
    const tired = createNeeds();
    tired.fatigue.level = 0.05;

    expect(needsSpeed(tired)).toBeLessThan(0.6);
  });
});

describe("the bedroll", () => {
  it("is in a new game's backpack, along with the axe, knife, and fire striker", () => {
    const view = createGame({ seed: 42 }).client.getView();
    expect(view.backpack).toEqual({ axe: 1, knife: 1, fireStriker: 1, bedroll: 1 });
  });

  it("can be laid on the ground at the player's feet, and picked up again", () => {
    const game = createGame({ seed: 42 });
    const at = game.client.getView().playerPosition;

    const bedrollId = layBedroll(game);

    expect(game.client.getView().backpack.bedroll).toBe(0);
    const laid = game.entities.with("bedroll", "position").first;
    expect(laid?.position.x).toBeCloseTo(at.x, 5);
    expect(laid?.position.z).toBeCloseTo(at.z, 5);

    send(game, { type: "pickUpBedroll", bedrollId });

    expect(game.client.getView().nearbyBedroll).toBeNull();
    expect(game.client.getView().backpack.bedroll).toBe(1);
    expect(game.entities.with("bedroll").entities).toHaveLength(0);
  });

  it("cannot be laid when the backpack holds none", () => {
    const game = createGame({ seed: 42 });
    send(game, { type: "layBedroll" });
    send(game, { type: "layBedroll" });

    expect(game.entities.with("bedroll").entities).toHaveLength(1);
  });

  it("is walked to before it is picked up from further away", () => {
    const game = createGame({ seed: 42 });
    const bedrollId = layBedroll(game);
    walkTo(game, offsetFromPlayer(game, 8));
    expect(game.client.getView().nearbyBedroll).toBeNull();

    send(game, { type: "pickUpBedroll", bedrollId });
    stepUntil(game, () => game.client.getView().backpack.bedroll === 1);

    expect(game.entities.with("bedroll").entities).toHaveLength(0);
  });
});

describe("sleeping on a bedroll", () => {
  it("at night skips to the next morning and restores fatigue", () => {
    const game = createGame({ seed: 42 });
    putCampfireBesidePlayer(game);
    send(game, { type: "skipTime", hours: 14 }); // 22:00.
    expect(game.client.getView().needs.fatigue).toBeLessThan(0.5);
    const bedrollId = layBedroll(game);

    send(game, { type: "sleep", bedrollId });

    const view = game.client.getView();
    expect(view.time).toMatchObject({ day: 2, hour: 6, minute: 0 });
    expect(view.needs.fatigue).toBeCloseTo(1, 3);
    expect(view.notice).not.toBe("collapsed");
  });

  it("keeps warmth draining when no lit campfire is near", () => {
    const game = createGame({ seed: 42 });
    send(game, { type: "skipTime", hours: 12 }); // 20:00: night falls.
    const bedrollId = layBedroll(game);

    send(game, { type: "sleep", bedrollId });

    // Ten hours of night with no fire is too cold to sleep through. The player collapses and wakes on the bedroll.
    const view = game.client.getView();
    expect(view.notice).toBe("collapsed");
    expect(view.time).toMatchObject({ day: 2, hour: 6, minute: 0 });
  });

  it("beside a lit campfire keeps the player warm through the night", () => {
    const game = createGame({ seed: 42 });
    putCampfireBesidePlayer(game);
    send(game, { type: "skipTime", hours: 12 }); // 20:00.
    const bedrollId = layBedroll(game);

    send(game, { type: "sleep", bedrollId });

    expect(game.client.getView().needs.warmth).toBe(1);
  });

  it("makes the bedroll the respawn point, so the player wakes there after a collapse", () => {
    const game = createGame({ seed: 42 });
    walkTo(game, offsetFromPlayer(game, -15));
    const bedrollAt = { ...game.client.getView().playerPosition };
    const bedrollId = layBedroll(game);
    send(game, { type: "skipTime", hours: 12 }); // 20:00.
    send(game, { type: "sleep", bedrollId }); // Cold: the player collapses in the night and wakes on the bedroll.
    expect(game.client.getView().notice).toBe("collapsed");

    walkTo(game, offsetFromPlayer(game, -15));
    send(game, { type: "skipTime", hours: 20 }); // Into the next night, with no fire, to a second collapse.

    const view = game.client.getView();
    expect(view.notice).toBe("collapsed");
    expect(view.time).toMatchObject({ day: 3, hour: 6 });
    expect(view.playerPosition.x).toBeCloseTo(bedrollAt.x, 5);
    expect(view.playerPosition.z).toBeCloseTo(bedrollAt.z, 5);
  });

  it("during the day restores fatigue without waiting for morning", () => {
    const game = createGame({ seed: 42 });
    send(game, { type: "skipTime", hours: 8 }); // 16:00.
    const bedrollId = layBedroll(game);

    send(game, { type: "sleep", bedrollId });

    const view = game.client.getView();
    expect(view.needs.fatigue).toBeCloseTo(1, 3);
    expect(view.time.day).toBe(1);
    expect(view.time.hour).toBeGreaterThanOrEqual(17);
    expect(view.time.hour).toBeLessThan(20);
  });

  it("walks the player to a bedroll further away first", () => {
    const game = createGame({ seed: 42 });
    putCampfireBesidePlayer(game);
    const bedrollId = layBedroll(game);
    walkTo(game, offsetFromPlayer(game, 8)); // Out of the campfire's warmth.
    send(game, { type: "skipTime", hours: 13 }); // 21:00.

    send(game, { type: "sleep", bedrollId });
    stepUntil(game, () => game.client.getView().time.day === 2);

    // Asleep on the bedroll, beside the fire, the player stays warm all night.
    expect(game.client.getView().time).toMatchObject({ day: 2, hour: 6 });
    expect(game.client.getView().notice).not.toBe("collapsed");
  });
});

describe("saving fatigue and the bedroll", () => {
  it("keeps fatigue, the laid bedroll, and the respawn point", () => {
    const game = createGame({ seed: 42 });
    walkTo(game, offsetFromPlayer(game, -10));
    const bedrollId = layBedroll(game);
    putCampfireBesidePlayer(game);
    send(game, { type: "skipTime", hours: 14 });
    send(game, { type: "sleep", bedrollId });
    walkTo(game, offsetFromPlayer(game, 10));
    send(game, { type: "skipTime", hours: 3 });

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(loaded.game.client.getView()).toEqual(game.client.getView());
    const player = loaded.game.entities.with("player", "respawnPoint").first;
    const bedroll = loaded.game.entities.with("bedroll", "position").first;
    expect(player?.respawnPoint.x).toBeCloseTo(bedroll?.position.x ?? NaN, 5);
    expect(player?.respawnPoint.z).toBeCloseTo(bedroll?.position.z ?? NaN, 5);
  });

  it("gives the player of a game saved before bedrolls existed a bedroll", () => {
    const save = writeSave(createGame({ seed: 42 }));
    const player = save.entities.find((entity) => entity.components.player)?.components;
    if (player?.backpack === undefined) throw new Error("No player backpack");
    delete player.backpack.contents.bedroll;

    // Version 2 saves have the valley's food but no bedroll. Version 3 added the bedroll.
    const upgraded = upgradeSave({ ...save, version: 2 });
    expect(upgraded?.version).toBe(SAVE_VERSION);
    const loaded = readSave(upgraded);
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(loaded.game.client.getView().backpack.bedroll).toBe(1);
  });
});

/** Lays the bedroll at the player's feet and returns its entity id. */
function layBedroll(game: Game): number {
  send(game, { type: "layBedroll" });
  const id = game.client.getView().nearbyBedroll?.id;
  if (id === undefined) throw new Error("No bedroll was laid");
  return id;
}

/** Puts a lit campfire with two days' fuel beside the player. */
function putCampfireBesidePlayer(game: Game): void {
  const { x, y, z } = game.client.getView().playerPosition;
  game.entities.add({ campfire: { lit: true, fuelMinutes: 48 * 60 }, position: { x: x + 2, y, z } });
}

/** A spot this many metres east (or west, if negative) of the player. */
function offsetFromPlayer(game: Game, metres: number): { x: number; z: number } {
  const { x, z } = game.client.getView().playerPosition;
  return { x: x + metres, z };
}

function walkTo(game: Game, to: { x: number; z: number }): void {
  send(game, { type: "walkTo", x: to.x, z: to.z });
  stepUntil(game, () => game.entities.with("player", "walkPath").first === undefined);
}

function stepUntil(game: Game, done: () => boolean): void {
  for (let steps = 0; !done(); steps += 1) {
    if (steps > 100_000) throw new Error("Gave up waiting");
    game.step();
  }
}

/** Sends the player to the nearest tree and runs the game until they start chopping it. */
function startChoppingNearestTree(game: Game): void {
  const player = game.entities.with("player", "position").first;
  if (player === undefined) throw new Error("No player");
  const distance = (at: { x: number; z: number }) => Math.hypot(at.x - player.position.x, at.z - player.position.z);
  const trees = game.entities.with("tree", "position").entities;
  const tree = trees.reduce((best, candidate) => (distance(candidate.position) < distance(best.position) ? candidate : best));
  const treeId = game.entities.id(tree);
  if (treeId === undefined) throw new Error("The tree has no id");
  send(game, { type: "chopTree", treeId });
  stepUntil(game, () => game.client.getView().action !== null);
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
}
