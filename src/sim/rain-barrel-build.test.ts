import { describe, expect, it } from "bun:test";
import { nearbyOf } from "./api-game-view";
import { RAIN_BARREL_BUILD_SECONDS, RAIN_BARREL_DRINK_LIMIT, RAIN_BARREL_MINUTES_PER_DRINK, RAIN_BARREL_PLANK_COST } from "./furniture/rain-barrel";
import { createGame } from "./game";
import { finishReach, piecesOf } from "./test-steps";
import { isWalkable } from "./walk-map";
import {
  blueprintOf,
  buildFully,
  drink,
  finishedBarrelNearPlayer,
  idOf,
  letRainFall,
  onlyPlayer,
  openSquareNearPlayer,
  place,
  send,
  stepUntil,
  stopRain,
} from "./rain-barrel-test-helpers";

describe("the rain barrel in the build menu", () => {
  it("lists the rain barrel as furniture after the stool, costing 6 planks and needing the axe", () => {
    const game = createGame({ seed: 42 });
    const menu = game.client.getView().buildMenu;

    expect(RAIN_BARREL_PLANK_COST).toBe(6);
    expect(RAIN_BARREL_BUILD_SECONDS).toBe(10);
    const stoolAt = menu.findIndex(({ structure }) => structure === "stool");
    expect(menu[stoolAt + 1]).toEqual({ structure: "rainBarrel", cost: [{ material: "plank", count: 6 }], tool: "axe", placement: "anywhere" });
  });
});

describe("building a rain barrel", () => {
  it("goes exactly where the mouse points, off the building grid", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    const at = { x: square.x + 0.13, z: square.z - 0.27 };

    const check = game.client.checkPlacement("rainBarrel", at, 1);
    expect(check.allowed).toBe(true);
    expect(check.spot).toMatchObject({ x: at.x, z: at.z });
  });

  it("needs the axe, and once built blocks walking, empty", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);
    send(game, place("rainBarrel", square.x, square.z, 0));
    const blueprint = blueprintOf(game, "rainBarrel");
    delete onlyPlayer(game).backpack.contents.axe;
    expect(game.client.refusal({ type: "build", blueprintId: idOf(game, blueprint) })).toEqual({
      kind: "cannotBuildYet",
      lacks: { kind: "tool", tool: "axe" },
    });

    onlyPlayer(game).backpack.contents.axe = 1;
    buildFully(game, blueprint);

    expect(blueprint.furniture).toBe("rainBarrel");
    expect(blueprint.rainBarrel).toEqual({ held: 0, progress: 0 });
    expect(isWalkable(game.walkMap, square)).toBe(false);
  });

  it("comes down giving back its 6 planks, and its water spills", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    barrel.rainBarrel = { held: 4, progress: 0.5 };
    const backpack = onlyPlayer(game).backpack;
    backpack.contents.plank = 0;

    send(game, { type: "takeDown", pieceId: idOf(game, barrel) });
    stepUntil(game, () => piecesOf(game.entities, "rainBarrel").length === 0);

    expect(backpack.contents.plank).toBe(RAIN_BARREL_PLANK_COST);
    expect(game.entities.with("rainBarrel").entities).toHaveLength(0);
    expect(backpack.contents.potOfBoiledWater ?? 0).toBe(0);
    expect(isWalkable(game.walkMap, barrel.position)).toBe(true);
  });
});

describe("catching rain", () => {
  it("gains 1 drink for every 2 game hours that rain falls on it", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    letRainFall(game);

    send(game, { type: "skipTime", hours: 5 });

    expect(RAIN_BARREL_MINUTES_PER_DRINK).toBe(120);
    expect(barrel.rainBarrel?.held).toBe(2);
    expect(barrel.rainBarrel?.progress).toBeCloseTo(0.5, 2);
  });

  it("carries progress over from one spell of rain to the next", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);

    letRainFall(game);
    send(game, { type: "skipTime", hours: 1 });
    stopRain(game);
    send(game, { type: "skipTime", hours: 3 });
    expect(barrel.rainBarrel?.held).toBe(0);
    letRainFall(game);
    send(game, { type: "skipTime", hours: 1 });

    expect(barrel.rainBarrel?.held).toBe(1);
  });

  it("gains nothing while snow falls in winter", () => {
    const game = createGame({ seed: 42, startSeason: "winter" });
    const barrel = finishedBarrelNearPlayer(game);
    letRainFall(game);

    send(game, { type: "skipTime", hours: 5 });

    expect(game.client.getView().snowing).toBe(true);
    expect(barrel.rainBarrel).toEqual({ held: 0, progress: 0 });
  });

  it("gains nothing while no rain falls", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    stopRain(game);

    send(game, { type: "skipTime", hours: 6 });

    expect(barrel.rainBarrel).toEqual({ held: 0, progress: 0 });
  });

  it("goes on filling while the player sleeps", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    letRainFall(game);
    send(game, { type: "layBedroll" });
    finishReach(game);
    const bedroll = game.entities.with("bedroll", "position").first;
    if (bedroll === undefined) throw new Error("No bedroll");
    onlyPlayer(game).needs.fatigue.level = 0.3;
    const before = game.progress().clockMinutes;

    send(game, { type: "sleep", bedrollId: idOf(game, bedroll) });

    const slept = game.progress().clockMinutes - before;
    expect(slept).toBeGreaterThan(RAIN_BARREL_MINUTES_PER_DRINK);
    expect(barrel.rainBarrel?.held).toBe(Math.min(RAIN_BARREL_DRINK_LIMIT, Math.floor(slept / RAIN_BARREL_MINUTES_PER_DRINK)));
  });

  it("holds at most 6 drinks, and builds up no progress while full", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    letRainFall(game);

    barrel.rainBarrel = { held: RAIN_BARREL_DRINK_LIMIT - 1, progress: 0.9 };

    send(game, { type: "skipTime", hours: 2 });
    expect(barrel.rainBarrel).toEqual({ held: RAIN_BARREL_DRINK_LIMIT, progress: 0 });

    drink(game, barrel);
    send(game, { type: "skipTime", hours: 1 });
    expect(barrel.rainBarrel.held).toBe(RAIN_BARREL_DRINK_LIMIT - 1);
    expect(barrel.rainBarrel.progress).toBeCloseTo(0.5, 2);
  });

  it("catches nothing under a roof, where rain would not fall on the player", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    const { x, z } = barrel.position;
    game.entities.add({ roof: { min: { x: x - 1, z: z - 1 }, max: { x: x + 1, z: z + 1 } } });
    letRainFall(game);

    send(game, { type: "skipTime", hours: 6 });

    expect(barrel.rainBarrel).toEqual({ held: 0, progress: 0 });
  });

  it("never lets its water go bad", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    barrel.rainBarrel = { held: 3, progress: 0 };
    stopRain(game);

    // The player may collapse in the cold of the nights. Time runs on all the same.
    send(game, { type: "skipTime", hours: 24 * 3 });

    expect(barrel.rainBarrel.held).toBe(3);
  });
});

describe("the rain barrel's panel", () => {
  it("shows its drinks out of 6 while the player stands beside it", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    barrel.rainBarrel = { held: 2, progress: 0.3 };
    game.step();

    expect(nearbyOf(game.client.getView(), "rainBarrel")).toEqual({ id: idOf(game, barrel), drinks: 2, limit: 6, underRoof: false });
  });

  it("says when it stands under a roof", () => {
    const game = createGame({ seed: 42 });
    const barrel = finishedBarrelNearPlayer(game);
    const { x, z } = barrel.position;
    game.entities.add({ roof: { min: { x: x - 1, z: z - 1 }, max: { x: x + 1, z: z + 1 } } });
    game.step();

    expect(nearbyOf(game.client.getView(), "rainBarrel")?.underRoof).toBe(true);
  });
});
