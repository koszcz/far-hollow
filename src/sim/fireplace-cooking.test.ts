import { describe, expect, it } from "bun:test";
import type { BackpackContent, Command } from "./api";
import { nearbyOf } from "./api";
import { BACKPACK_WEIGHT_LIMIT_KG, CONTENT_WEIGHT_KG } from "./backpack";
import type { Entity } from "./entities";
import { foundationDeckTop } from "./foundations";
import { COOK_MINUTES } from "./fish-on-fire";
import { FIRE_JUG_MINUTES } from "./jug-on-fire";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { BOIL_MINUTES } from "./pot-state";
import { readSave, type SaveFile, writeSave } from "./save";
import { SAVE_VERSION } from "./save-upgrades";
import { FIREPLACE_COOKING_SAVE_VERSION, FIREPLACE_FIRES_SAVE_VERSION } from "./save-versions";
import { FIREPLACE_STONE_COST } from "./structures";
import { finishReach } from "./test-steps";
import { terrainHeightAt } from "./valley";
import { isWalkable } from "./walk-map";

describe("cooking fish on a fireplace", () => {
  it("puts raw fish from the backpack on a lit fireplace, up to 3, and they cook in 8 game minutes", () => {
    const { game, campfireId } = gameWithLitFireplace();
    give(game, "rawFish", 4);

    for (let i = 0; i < 4; i += 1) send(game, { type: "cookFish", campfireId });

    expect(fishOnFire(game)).toHaveLength(3);
    expect(game.client.getView().backpack.rawFish).toBe(1);
    expect(game.client.refusal({ type: "cookFish", campfireId })).toEqual({ kind: "fireFullOfFish" });
    skipMinutes(game, COOK_MINUTES / 2);
    expect(fishOnFire(game)[0]?.cooked).toBe(false);
    skipMinutes(game, COOK_MINUTES / 2);
    expect(fishOnFire(game).every(({ cooked }) => cooked)).toBe(true);
  });

  it("keeps each fish's progress while the fireplace is out, and will not take fish then", () => {
    const { game, fireplace, campfireId } = gameWithLitFireplace();
    game.entities.addComponent(fireplace, "fishOnFire", [{ minutesCooked: 3 }]);
    fireplace.fireplace = { lit: false, fuelMinutes: 0 };
    give(game, "rawFish", 1);

    skipMinutes(game, 60);

    expect(fireplace.fishOnFire).toEqual([{ minutesCooked: 3 }]);
    expect(game.client.refusal({ type: "cookFish", campfireId })).toEqual({ kind: "lightFirst" });
  });
});

describe("firing a jug on a fireplace", () => {
  it("fires an unfired jug in 20 game minutes, keeps its progress while the fire is out, and takes it off as a jug", () => {
    const { game, fireplace, campfireId } = gameWithLitFireplace();
    give(game, "unfiredJug", 1);

    send(game, { type: "fireJug", campfireId });
    skipMinutes(game, FIRE_JUG_MINUTES / 2);
    fireplace.fireplace = { lit: false, fuelMinutes: 0 };
    const progressWhenOut = nearbyOf(game.client.getView(), "campfire")?.jug?.fireProgress ?? 0;
    skipMinutes(game, 60);
    expect(nearbyOf(game.client.getView(), "campfire")?.jug).toEqual({ fired: false, fireProgress: progressWhenOut });

    fireplace.fireplace = { lit: true, fuelMinutes: 120 };
    skipMinutes(game, FIRE_JUG_MINUTES / 2 + 0.5);
    expect(nearbyOf(game.client.getView(), "campfire")?.jug).toEqual({ fired: true, fireProgress: 1 });
    resume(game);
    send(game, { type: "takeJugOff", campfireId });
    expect(game.client.getView().backpack.jug).toBe(1);
    expect(fireplace.jugOnFire).toBeUndefined();
  });
});

describe("taking fish off a fireplace", () => {
  it("takes cooked fish first, as far as they fit in the backpack, and leaves the rest on", () => {
    const { game, fireplace, campfireId } = gameWithLitFireplace();
    fireplace.fireplace = { lit: false, fuelMinutes: 0 };
    game.entities.addComponent(fireplace, "fishOnFire", [{ minutesCooked: 3 }, { minutesCooked: COOK_MINUTES }, { minutesCooked: 1 }]);
    fillBackpackLeaving(game, CONTENT_WEIGHT_KG.cookedFish);

    send(game, { type: "takeFishOff", campfireId });

    expect(game.client.getView().backpack.cookedFish).toBe(1);
    expect(fireplace.fishOnFire).toEqual([{ minutesCooked: 3 }, { minutesCooked: 1 }]);
    expect(game.client.getView().notice?.kind).toBe("backpackFull");

    onlyPlayer(game).backpack.contents.berries = 0;
    send(game, { type: "takeFishOff", campfireId });
    expect(game.client.getView().backpack.rawFish).toBe(2);
    expect(fireplace.fishOnFire).toBeUndefined();
  });
});

describe("boiling water on a fireplace", () => {
  it("puts the full pot on a lit fireplace, boils the water in the same time as a campfire, and takes the pot off", () => {
    const { game, campfireId } = gameWithLitFireplace();
    give(game, "potOfRiverWater", 1);

    send(game, { type: "putPotOnFire", campfireId });
    expect(game.client.getView().backpack.potOfRiverWater ?? 0).toBe(0);
    // The pot starts heating while the player's hand is still drawing back, which takes well under a game minute.
    expect(nearbyOf(game.client.getView(), "campfire")?.pot?.water).toBe("river");
    expect(nearbyOf(game.client.getView(), "campfire")?.pot?.boilProgress).toBeLessThan(1 / BOIL_MINUTES);

    skipMinutes(game, BOIL_MINUTES - 1);
    expect(nearbyOf(game.client.getView(), "campfire")?.pot?.water).toBe("river");
    skipMinutes(game, 1);
    expect(nearbyOf(game.client.getView(), "campfire")?.pot?.water).toBe("boiled");

    resume(game);
    send(game, { type: "takePotOffFire", campfireId });
    expect(game.client.getView().backpack.potOfBoiledWater).toBe(1);
    expect(nearbyOf(game.client.getView(), "campfire")?.pot).toBeNull();
  });

  it("will not take the pot on a fireplace that is out", () => {
    const { game, fireplace, campfireId } = gameWithLitFireplace();
    fireplace.fireplace = { lit: false, fuelMinutes: 60 };
    give(game, "potOfRiverWater", 1);

    expect(game.client.refusal({ type: "putPotOnFire", campfireId })).toEqual({ kind: "lightFirst" });
    send(game, { type: "putPotOnFire", campfireId });
    expect(fireplace.potOnFire).toBeUndefined();
  });
});

describe("taking down a fireplace that holds a pot or fish", () => {
  it("is refused with the reason, and the fireplace stays", () => {
    const { game, fireplace, campfireId } = gameWithLitFireplace();
    fireplace.fireplace = { lit: false, fuelMinutes: 0 };
    game.entities.addComponent(fireplace, "potOnFire", { water: "river", minutesBoiling: 0 });
    expect(game.client.refusal({ type: "takeDown", pieceId: campfireId })).toEqual({ kind: "potOnFire" });

    game.entities.removeComponent(fireplace, "potOnFire");
    game.entities.addComponent(fireplace, "fishOnFire", [{ minutesCooked: 0 }]);
    expect(game.client.refusal({ type: "takeDown", pieceId: campfireId })).toEqual({ kind: "fishOnFire" });
    send(game, { type: "takeDown", pieceId: campfireId });
    runSeconds(game, 30);
    expect(game.entities.has(fireplace)).toBe(true);

    game.entities.removeComponent(fireplace, "fishOnFire");
    expect(game.client.refusal({ type: "takeDown", pieceId: campfireId })).toBeNull();
  });
});

describe("saving the pot and fish on a fireplace", () => {
  it("keeps them with their progress", () => {
    const { game, fireplace, campfireId } = gameWithLitFireplace();
    game.entities.addComponent(fireplace, "potOnFire", { water: "river", minutesBoiling: 2 });
    game.entities.addComponent(fireplace, "fishOnFire", [{ minutesCooked: COOK_MINUTES }, { minutesCooked: 2.5 }]);

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save was rejected");

    const saved = loaded.game.entities.entity(campfireId);
    expect(saved?.potOnFire).toEqual({ water: "river", minutesBoiling: 2 });
    expect(saved?.fishOnFire).toEqual([{ minutesCooked: COOK_MINUTES }, { minutesCooked: 2.5 }]);
  });

  it("raises the save version, and upgrades an older save with a fireplace", () => {
    const { game } = gameWithLitFireplace();
    expect(FIREPLACE_COOKING_SAVE_VERSION).toBeGreaterThan(FIREPLACE_FIRES_SAVE_VERSION);
    expect(FIREPLACE_COOKING_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    const save = JSON.parse(JSON.stringify(writeSave(game))) as SaveFile;
    save.version = FIREPLACE_COOKING_SAVE_VERSION - 1;

    const loaded = readSave(save);
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(writeSave(loaded.game).version).toBe(SAVE_VERSION);
    expect(loaded.game.entities.with("fireplace").entities.map(({ fireplace }) => fireplace.lit)).toEqual([true]);
  });
});

describe("cooking on a campfire beside a fireplace", () => {
  it("still cooks fish and boils water on the campfire", () => {
    const { game, fireplace } = gameWithLitFireplace();
    const position = {
      x: fireplace.position.x,
      y: terrainHeightAt(game.valley.terrain, fireplace.position.x, fireplace.position.z + 2),
      z: fireplace.position.z + 2,
    };
    const campfire = game.entities.add({ campfire: { lit: true, fuelMinutes: 120 }, position });
    const campfireId = idOf(game, campfire);
    onlyPlayer(game).position = { x: position.x + 1.2, y: position.y, z: position.z + 0.5 };
    onlyPlayer(game).previousPosition = { ...onlyPlayer(game).position };
    give(game, "rawFish", 1);
    give(game, "potOfRiverWater", 1);

    send(game, { type: "cookFish", campfireId });
    send(game, { type: "putPotOnFire", campfireId });
    skipMinutes(game, COOK_MINUTES);

    expect(campfire.fishOnFire).toEqual([{ minutesCooked: COOK_MINUTES }]);
    expect(campfire.potOnFire?.water).toBe("boiled");
    expect(fireplace.fishOnFire).toBeUndefined();
  });
});

type Fireplace = Entity & { position: NonNullable<Entity["position"]> };

/** The fish on the fireplace beside the player, as its panel shows them. */
function fishOnFire(game: Game) {
  return nearbyOf(game.client.getView(), "campfire")?.fish ?? [];
}

/** A new game where the player stands beside a fireplace they built, lit with one piece of firewood. */
function gameWithLitFireplace(): { game: Game; fireplace: Fireplace; campfireId: number } {
  const game = createGame({ seed: 42 });
  const square = openSquareNearPlayer(game);
  game.entities.add({ foundation: true, facing: { turns: 0 }, position: { x: square.x, y: foundationDeckTop(game.valley.terrain, square), z: square.z } });
  give(game, "stone", FIREPLACE_STONE_COST);
  send(game, { type: "placeBlueprint", structure: "fireplace", turns: 0, x: square.x, z: square.z });
  const blueprint = game.entities.with("blueprint", "position").first;
  if (blueprint === undefined) throw new Error("No blueprint");
  const built: Entity = blueprint;
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => built.blueprint === undefined);
  const fireplace = game.entities.with("fireplace", "position").first;
  if (fireplace === undefined) throw new Error("No fireplace");
  const campfireId = idOf(game, fireplace);
  game.client.send({ type: "tendCampfire", campfireId });
  game.step();
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
  finishReach(game);
  give(game, "firewood", 1);
  send(game, { type: "addFuel", campfireId, fuel: "firewood" });
  send(game, { type: "lightCampfire", campfireId });
  if (!fireplace.fireplace.lit) throw new Error("The fireplace did not light");
  return { game, fireplace, campfireId };
}

/** Fills the backpack with berries until only `kilograms` of room is left. */
function fillBackpackLeaving(game: Game, kilograms: number): void {
  const room = BACKPACK_WEIGHT_LIMIT_KG - game.client.getView().backpackWeight - kilograms;
  give(game, "berries", Math.floor(room / CONTENT_WEIGHT_KG.berries + 1e-6));
}

/** Unpauses the game, so the player can reach for things again after skipping time. */
function resume(game: Game): void {
  game.client.send({ type: "setPaused", paused: false });
}

function runSeconds(game: Game, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * STEPS_PER_SECOND); i += 1) game.step();
}

/** Moves the clock on. The game is paused first, so the player stays put. */
function skipMinutes(game: Game, minutes: number): void {
  send(game, { type: "setPaused", paused: true });
  send(game, { type: "skipTime", hours: minutes / 60 });
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
  finishReach(game);
}

function give(game: Game, content: BackpackContent, count: number): void {
  const contents = onlyPlayer(game).backpack.contents;
  contents[content] = (contents[content] ?? 0) + count;
}

/** The middle of a building-grid square a few metres from the player, with open ground three squares all round it. */
function openSquareNearPlayer(game: Game): { x: number; z: number } {
  const player = onlyPlayer(game);
  for (let distance = 4; distance < 30; distance += 1) {
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [0, -1],
      [-1, 0],
    ] as const) {
      const square = { x: Math.floor(player.position.x + dx * distance) + 0.5, z: Math.floor(player.position.z + dz * distance) + 0.5 };
      const reach = [-3, -2, -1, 0, 1, 2, 3];
      const open = reach.every((ax) => reach.every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })));
      if (open && game.client.checkPlacement("foundation", square, 0).allowed) return square;
    }
  }
  throw new Error("No open square");
}

function stepUntil(game: Game, done: () => boolean, maxSteps = 100_000): void {
  for (let i = 0; i < maxSteps; i += 1) {
    if (done()) return;
    game.step();
  }
  throw new Error("Never happened");
}

function onlyPlayer(game: Game) {
  const player = game.entities.with("player", "position", "backpack").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
