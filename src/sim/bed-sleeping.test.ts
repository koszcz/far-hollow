import { describe, expect, it } from "bun:test";
import { createGame } from "./game";
import { isWalkable } from "./walk-map";
import { piecesOf } from "./test-steps";
import {
  blueprintOf,
  buildFully,
  finishedBedNearPlayer,
  idOf,
  minutesOfDay,
  onlyPlayer,
  openSquareNearPlayer,
  place,
  send,
  stepUntil,
  walkTo,
} from "./bed-test-helpers";

describe("sleeping in a bed", () => {
  it("by day restores fatigue twice as fast as a bedroll, in 2 hours from half", () => {
    const game = createGame({ seed: 42 });
    const bed = finishedBedNearPlayer(game);
    onlyPlayer(game).needs.fatigue.level = 0.5;
    const before = game.client.getView().time;

    send(game, { type: "sleepInBed", bedId: idOf(game, bed) });
    stepUntil(game, () => game.client.getView().lastSleep !== null);

    // A bedroll in the open restores 1/8 of fatigue an hour, so half takes 4 hours there.
    const view = game.client.getView();
    expect(view.needs.fatigue).toBeCloseTo(1, 3);
    expect(minutesOfDay(view.time) - minutesOfDay(before)).toBeCloseTo(120, -1);
  });

  it("under a roof restores fatigue three times as fast as a bedroll in the open", () => {
    const game = createGame({ seed: 42 });
    const bed = finishedBedNearPlayer(game);
    // A cabin roof over the bed and the ground round it.
    const { x, z } = bed.position;
    game.entities.add({ cabinRoof: true, roof: { min: { x: x - 3, z: z - 3 }, max: { x: x + 3, z: z + 3 } } });
    onlyPlayer(game).needs.fatigue.level = 0.5;
    const before = game.client.getView().time;

    send(game, { type: "sleepInBed", bedId: idOf(game, bed) });
    stepUntil(game, () => game.client.getView().lastSleep !== null);

    const view = game.client.getView();
    expect(view.needs.fatigue).toBeCloseTo(1, 3);
    expect(minutesOfDay(view.time) - minutesOfDay(before)).toBeCloseTo(80, -1);
  });

  it("at night sleeps until morning, as on a bedroll", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const bed = finishedBedNearPlayer(game);
    send(game, { type: "placeBlueprint", structure: "campfire", turns: 0, x: bed.position.x + 2, z: bed.position.z });
    send(game, { type: "skipTime", hours: 14 }); // 22:00.

    send(game, { type: "sleepInBed", bedId: idOf(game, bed) });
    stepUntil(game, () => game.client.getView().lastSleep !== null);

    expect(game.client.getView().time).toMatchObject({ day: 2, hour: 6, minute: 0 });
  });

  it("in the evening sleeps on until morning rather than waking in the night", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const bed = finishedBedNearPlayer(game);
    send(game, { type: "placeBlueprint", structure: "campfire", turns: 0, x: bed.position.x + 2, z: bed.position.z });
    send(game, { type: "skipTime", hours: 10 }); // 18:00, before night falls.
    onlyPlayer(game).needs.fatigue.level = 0.2;

    send(game, { type: "sleepInBed", bedId: idOf(game, bed) });
    stepUntil(game, () => game.client.getView().lastSleep !== null);

    // Restoring fatigue alone would take about 3 hours and wake the player at 21:00, in the night.
    expect(game.client.getView().time).toMatchObject({ day: 2, hour: 6, minute: 0 });
  });

  it("walks the player to the bed first, and reports the sleep with where the bed stands and which way it faces", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game, 8);
    send(game, place("bed", square.x, square.z, 3));
    const bed = blueprintOf(game, "bed");
    buildFully(game, bed);
    walkTo(game, { x: square.x + 6, z: square.z });
    expect(game.client.getView().lastSleep).toBeNull();

    send(game, { type: "sleepInBed", bedId: idOf(game, bed) });
    stepUntil(game, () => game.client.getView().lastSleep !== null);

    expect(game.client.getView().lastSleep).toEqual({ count: 1, at: { x: square.x, z: square.z }, bed: { turns: 3 } });
  });

  it("walks the player to the near side of the bed, the side they come from, and stops within reach", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game, 8);
    send(game, place("bed", square.x, square.z, 0));
    const bed = blueprintOf(game, "bed");
    buildFully(game, bed);
    // The open ground nearest the bed's middle is off its -x side, so a walk to its middle ends there, on the far side.
    walkTo(game, { x: square.x + 6, z: square.z });

    send(game, { type: "sleepInBed", bedId: idOf(game, bed) });
    const player = onlyPlayer(game);
    stepUntil(game, () => player.walkPath === undefined);

    expect(player.position.x).toBeGreaterThan(square.x + 0.5);
    expect(Math.abs(player.position.z - square.z)).toBeLessThan(1);
    expect(player.position.x - (square.x + 0.5)).toBeLessThanOrEqual(1);
    expect(game.client.getView().lastSleep).not.toBeNull();
  });

  it("walks a player standing past the bed's head or foot round to a long side, so they never step over a headboard", () => {
    for (const turns of [0, 1] as const) {
      const game = createGame({ seed: 42 });
      const square = openSquareNearPlayer(game, 8);
      send(game, place("bed", square.x, square.z, turns));
      const bed = blueprintOf(game, "bed");
      buildFully(game, bed);
      // 1.8 m from the middle along the bed's length is 0.8 m past its end, within reach of it.
      const along = turns === 0 ? { x: 0, z: 1 } : { x: 1, z: 0 };
      walkTo(game, { x: square.x + along.x * 1.8, z: square.z + along.z * 1.8 });

      send(game, { type: "sleepInBed", bedId: idOf(game, bed) });
      stepUntil(game, () => game.client.getView().lastSleep !== null);

      const player = onlyPlayer(game);
      const lengthwise = Math.abs((player.position.x - square.x) * along.x + (player.position.z - square.z) * along.z);
      const sideways = Math.abs((player.position.x - square.x) * along.z + (player.position.z - square.z) * along.x);
      expect(lengthwise).toBeLessThan(1);
      expect(sideways).toBeGreaterThan(0.5);
      expect(sideways).toBeLessThanOrEqual(1.5);
    }
  });

  it("walks the player round to the far long side when something blocks the near one", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game, 8);
    send(game, place("bed", square.x, square.z, 0));
    const bed = blueprintOf(game, "bed");
    buildFully(game, bed);
    walkTo(game, { x: square.x + 4, z: square.z });
    // Something fills the two walk-map squares along the bed's +x side, the side the player comes from.
    const blocked = [0.9, 1.9].flatMap((dx) => [-1, -0.5, 0, 0.5, 1].map((dz) => ({ x: square.x + dx, z: square.z + dz })));
    game.entities.add({ blocksWalkingSpots: blocked });

    send(game, { type: "sleepInBed", bedId: idOf(game, bed) });
    stepUntil(game, () => game.client.getView().lastSleep !== null);

    const player = onlyPlayer(game);
    expect(player.position.x).toBeLessThan(square.x - 0.5);
    expect(Math.abs(player.position.z - square.z)).toBeLessThan(1);
  });

  it("makes the spot where the bed stands the respawn point, and taking the bed down leaves it there", () => {
    const game = createGame({ seed: 42 });
    const bed = finishedBedNearPlayer(game);
    const bedAt = { x: bed.position.x, z: bed.position.z };

    send(game, { type: "sleepInBed", bedId: idOf(game, bed) });
    stepUntil(game, () => game.client.getView().lastSleep !== null);
    expect(onlyPlayer(game).respawnPoint).toEqual(bedAt);

    send(game, { type: "takeDown", pieceId: idOf(game, bed) });
    stepUntil(game, () => piecesOf(game.entities, "bed").length === 0);
    expect(onlyPlayer(game).respawnPoint).toEqual(bedAt);
  });

  it("wakes the player beside the bed after a collapse, not inside it", () => {
    const game = createGame({ seed: 42 });
    const bed = finishedBedNearPlayer(game);
    send(game, { type: "sleepInBed", bedId: idOf(game, bed) });
    stepUntil(game, () => game.client.getView().lastSleep !== null);
    walkTo(game, { x: bed.position.x + 12, z: bed.position.z });

    // A night with no fire is too cold to get through.
    send(game, { type: "skipTime", hours: 30 });

    const view = game.client.getView();
    expect(view.notice?.kind).toBe("collapsed");
    expect(Math.hypot(view.playerPosition.x - bed.position.x, view.playerPosition.z - bed.position.z)).toBeLessThan(2);
    expect(isWalkable(game.walkMap, view.playerPosition)).toBe(true);
  });

  it("is what E reaches, beside the player", () => {
    const game = createGame({ seed: 42 });
    const bed = finishedBedNearPlayer(game);

    expect(game.client.nearestInReach()).toEqual({ kind: "furniture", id: idOf(game, bed), furniture: "bed" });
  });
});
