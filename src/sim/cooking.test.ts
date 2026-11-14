import { describe, expect, it } from "bun:test";
import type { BackpackContent, Command } from "./api";
import { nearbyOf } from "./api";
import { BACKPACK_WEIGHT_LIMIT_KG, CONTENT_WEIGHT_KG } from "./backpack";
import { FUEL_BURN_MINUTES } from "./campfires";
import type { Entity } from "./entities";
import { COOK_MINUTES, FISH_ON_FIRE_LIMIT } from "./fish-on-fire";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { COOKING_SAVE_VERSION, readSave, SAVE_VERSION, writeSave, type SaveFile } from "./save";
import { CAMPFIRE_BUILD_SECONDS, CAMPFIRE_STICK_COST } from "./structures";
import { finishReach } from "./test-steps";
import { isWalkable } from "./walk-map";

describe("cooking fish", () => {
  it("puts one raw fish from the backpack on a lit fire, and it is cooked after 8 game minutes", () => {
    const { game, campfireId } = gameWithLitCampfire();
    give(game, "rawFish", 2);

    send(game, { type: "cookFish", campfireId });

    expect(game.client.getView().backpack.rawFish).toBe(1);
    expect(fishOnFire(game)).toHaveLength(1);
    expect(fishOnFire(game)[0]?.cooked).toBe(false);
    skipMinutes(game, COOK_MINUTES / 2);
    expect(fishOnFire(game)[0]?.cookProgress).toBeGreaterThan(0.45);
    expect(fishOnFire(game)[0]?.cooked).toBe(false);
    skipMinutes(game, COOK_MINUTES / 2);
    expect(fishOnFire(game)[0]).toEqual({ cooked: true, cookProgress: 1 });
  });

  it("takes 8 game minutes", () => {
    expect(COOK_MINUTES).toBe(8);
  });

  it("never burns cooked fish, however long they stay on", () => {
    const { game, campfireId } = gameWithLitCampfire();
    give(game, "rawFish", 1);
    send(game, { type: "cookFish", campfireId });

    skipMinutes(game, 6 * 60);

    expect(fishOnFire(game)).toEqual([{ cooked: true, cookProgress: 1 }]);
    resume(game);
    send(game, { type: "takeFishOff", campfireId });
    expect(game.client.getView().backpack.cookedFish).toBe(1);
  });

  it("holds 3 fish at most, and keeps the rest in the backpack", () => {
    const { game, campfireId } = gameWithLitCampfire();
    give(game, "rawFish", 5);

    for (let i = 0; i < 5; i += 1) send(game, { type: "cookFish", campfireId });

    expect(FISH_ON_FIRE_LIMIT).toBe(3);
    expect(fishOnFire(game)).toHaveLength(3);
    expect(game.client.getView().backpack.rawFish).toBe(2);
    expect(nearbyOf(game.client.getView(), "campfire")?.fitsFish).toBe(false);
  });

  it("sits beside the pot, so both can be on the fire at once", () => {
    const { game, campfireId } = gameWithLitCampfire();
    give(game, "potOfRiverWater", 1);
    give(game, "rawFish", 1);

    send(game, { type: "putPotOnFire", campfireId });
    send(game, { type: "cookFish", campfireId });

    expect(nearbyOf(game.client.getView(), "campfire")?.pot).not.toBeNull();
    expect(fishOnFire(game)).toHaveLength(1);
  });

  it("will not put fish on a fire that is not lit, or without raw fish", () => {
    const unlit = gameWithLitCampfire();
    unlit.campfire.campfire.lit = false;
    give(unlit.game, "rawFish", 1);
    send(unlit.game, { type: "cookFish", campfireId: unlit.campfireId });
    expect(fishOnFire(unlit.game)).toEqual([]);
    expect(unlit.game.client.getView().backpack.rawFish).toBe(1);

    const noFish = gameWithLitCampfire();
    give(noFish.game, "cookedFish", 1);
    send(noFish.game, { type: "cookFish", campfireId: noFish.campfireId });
    expect(fishOnFire(noFish.game)).toEqual([]);
    expect(noFish.game.client.getView().backpack.cookedFish).toBe(1);
  });

  it("stops when the fire goes out, keeps the progress, and goes on when it is lit again", () => {
    const { game, campfire, campfireId } = gameWithLitCampfire("stick");
    give(game, "rawFish", 1);
    // A stick burns for 20 minutes. Let most of it burn first, so the fire goes out halfway through cooking.
    skipMinutes(game, FUEL_BURN_MINUTES.stick - COOK_MINUTES / 2);
    resume(game);
    send(game, { type: "cookFish", campfireId });

    skipMinutes(game, COOK_MINUTES * 2);
    expect(nearbyOf(game.client.getView(), "campfire")?.lit).toBe(false);
    const progressWhenOut = fishOnFire(game)[0]?.cookProgress ?? 0;
    expect(progressWhenOut).toBeGreaterThan(0.4);
    expect(progressWhenOut).toBeLessThan(0.6);
    expect(fishOnFire(game)[0]?.cooked).toBe(false);

    skipMinutes(game, 60);
    expect(fishOnFire(game)[0]?.cookProgress).toBe(progressWhenOut);

    resume(game);
    give(game, "firewood", 1);
    send(game, { type: "addFuel", campfireId, fuel: "firewood" });
    send(game, { type: "lightCampfire", campfireId });
    expect(campfire.campfire.lit).toBe(true);
    skipMinutes(game, COOK_MINUTES / 2 + 0.5);
    expect(fishOnFire(game)[0]).toEqual({ cooked: true, cookProgress: 1 });
  });
});

describe("taking fish off the fire", () => {
  it("moves every fish into the backpack, raw or cooked", () => {
    const { game, campfire, campfireId } = gameWithLitCampfire();
    game.entities.addComponent(campfire, "fishOnFire", [{ minutesCooked: COOK_MINUTES }, { minutesCooked: 2 }, { minutesCooked: COOK_MINUTES }]);

    send(game, { type: "takeFishOff", campfireId });

    expect(game.client.getView().backpack).toMatchObject({ cookedFish: 2, rawFish: 1 });
    expect(campfire.fishOnFire).toBeUndefined();
    expect(fishOnFire(game)).toEqual([]);
  });

  it("takes cooked fish first when the backpack is full, and leaves the rest cooking", () => {
    const { game, campfire, campfireId } = gameWithLitCampfire();
    game.entities.addComponent(campfire, "fishOnFire", [{ minutesCooked: 3 }, { minutesCooked: COOK_MINUTES }, { minutesCooked: 1 }]);
    fillBackpackLeaving(game, CONTENT_WEIGHT_KG.cookedFish);

    send(game, { type: "takeFishOff", campfireId });

    expect(game.client.getView().backpack.cookedFish).toBe(1);
    expect(game.client.getView().backpack.rawFish ?? 0).toBe(0);
    // The two raw fish stay on in their order, and went on cooking while the player reached for the fire.
    const left = campfire.fishOnFire?.map(({ minutesCooked }) => minutesCooked) ?? [];
    expect(left).toHaveLength(2);
    expect(left[0]).toBeCloseTo(3 + (left[1] ?? 0) - 1, 6);
    expect(left[1]).toBeGreaterThan(1);
    expect(left[0]).toBeLessThan(COOK_MINUTES);
    expect(game.client.getView().notice?.kind).toBe("backpackFull");
  });
});

describe("taking down a campfire with fish on it", () => {
  it("is refused, and the player is told to empty it first", () => {
    const { game, campfire, campfireId } = gameWithLitCampfire();
    game.entities.addComponent(campfire, "fishOnFire", [{ minutesCooked: 0 }]);
    campfire.campfire.lit = false;

    send(game, { type: "takeDown", pieceId: campfireId });
    expect(game.client.getView().notice?.kind).toBe("stillHoldsSomething");
    runSeconds(game, CAMPFIRE_BUILD_SECONDS);

    expect(game.entities.has(campfire)).toBe(true);
    expect(campfire.fishOnFire).toHaveLength(1);
  });
});

describe("cooked fish", () => {
  it("fills hunger by 0.3 and does not make the player sick", () => {
    const game = createGame({ seed: 42 });
    give(game, "cookedFish", 2);
    onlyPlayer(game).needs.hunger.level = 0.5;

    send(game, { type: "eat", food: "cookedFish" });

    expect(game.client.getView().needs.hunger).toBeCloseTo(0.8, 2);
    expect(game.client.getView().sick).toBe(false);
    expect(game.client.getView().backpack.cookedFish).toBe(1);
  });

  it("weighs 0.5 kg", () => {
    expect(CONTENT_WEIGHT_KG.cookedFish).toBe(0.5);
  });

  it("drops as a pile at the player's feet", () => {
    const game = createGame({ seed: 42 });
    give(game, "cookedFish", 3);

    send(game, { type: "dropFromBackpack", content: "cookedFish" });

    expect(game.client.getView().backpack.cookedFish ?? 0).toBe(0);
    expect([...game.entities.with("pile")].map(({ pile }) => pile)).toContainEqual({ content: "cookedFish", count: 3 });
  });
});

describe("saving cooking", () => {
  it("raises the save version", () => {
    expect(COOKING_SAVE_VERSION).toBe(SAVE_VERSION);
  });

  it("keeps the fish on a campfire with their progress, and cooked fish in the backpack, a pile, and a chest", () => {
    const { game, campfire, campfireId } = gameWithLitCampfire();
    give(game, "cookedFish", 2);
    game.entities.addComponent(campfire, "fishOnFire", [{ minutesCooked: COOK_MINUTES }, { minutesCooked: 2.5 }]);
    game.entities.add({ pile: { content: "cookedFish", count: 3 }, position: { x: 1, y: 0, z: 1 } });
    game.entities.add({ chest: { contents: { cookedFish: 4 } }, facing: { turns: 0 }, position: { x: 4, y: 0, z: 4 } });

    const saved = writeSave(game);
    expect(saved.version).toBe(SAVE_VERSION);
    const loaded = readSave(JSON.parse(JSON.stringify(saved)));
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(loaded.game.entities.entity(campfireId)?.fishOnFire).toEqual([{ minutesCooked: COOK_MINUTES }, { minutesCooked: 2.5 }]);
    expect(nearbyOf(loaded.game.client.getView(), "campfire")?.fish).toEqual([
      { cooked: true, cookProgress: 1 },
      { cooked: false, cookProgress: 2.5 / COOK_MINUTES },
    ]);
    expect(loaded.game.client.getView().backpack.cookedFish).toBe(2);
    expect([...loaded.game.entities.with("pile")].map(({ pile }) => pile)).toContainEqual({ content: "cookedFish", count: 3 });
    expect([...loaded.game.entities.with("chest")].map(({ chest }) => chest.contents)).toContainEqual({ cookedFish: 4 });
  });

  it("turns away a campfire holding more than 3 fish", () => {
    const { game, campfire } = gameWithLitCampfire();
    game.entities.addComponent(campfire, "fishOnFire", [{ minutesCooked: 0 }, { minutesCooked: 0 }, { minutesCooked: 0 }, { minutesCooked: 0 }]);

    expect(readSave(JSON.parse(JSON.stringify(writeSave(game)))).ok).toBe(false);
  });

  it("upgrades a save from before cooking unchanged", () => {
    const game = createGame({ seed: 42 });
    give(game, "rawFish", 2);
    const save = JSON.parse(JSON.stringify(writeSave(game))) as SaveFile;
    save.version = COOKING_SAVE_VERSION - 1;

    const loaded = readSave(save);
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(writeSave(loaded.game).version).toBe(SAVE_VERSION);
    expect(loaded.game.client.getView().backpack).toEqual(onlyPlayer(game).backpack.contents);
  });
});

/** The fish on the campfire beside the player, as its panel shows them. */
function fishOnFire(game: Game) {
  return nearbyOf(game.client.getView(), "campfire")?.fish ?? [];
}

/** A new game where the player stands beside a campfire they built, lit with one piece of fuel of the given kind. */
function gameWithLitCampfire(fuel: "stick" | "firewood" = "firewood") {
  const game = createGame({ seed: 42 });
  give(game, "stick", CAMPFIRE_STICK_COST);
  const spot = openSpotNearPlayer(game);
  send(game, { type: "placeBlueprint", structure: "campfire", turns: 0, x: spot.x, z: spot.z });
  const blueprint = game.entities.with("blueprint", "position").first;
  if (blueprint === undefined) throw new Error("No blueprint");
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => game.entities.with("campfire").size > 0);
  const campfire = game.entities.with("campfire", "position").first;
  if (campfire === undefined) throw new Error("No campfire");
  const campfireId = idOf(game, campfire);
  game.client.send({ type: "tendCampfire", campfireId });
  game.step();
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
  finishReach(game);
  give(game, fuel, 1);
  send(game, { type: "addFuel", campfireId, fuel });
  send(game, { type: "lightCampfire", campfireId });
  if (!campfire.campfire.lit) throw new Error("The campfire did not light");
  return { game, campfire, campfireId };
}

/** Fills the backpack with berries until only `kilograms` of room is left. */
function fillBackpackLeaving(game: Game, kilograms: number): void {
  const room = BACKPACK_WEIGHT_LIMIT_KG - game.client.getView().backpackWeight - kilograms;
  give(game, "berries", Math.floor(room / CONTENT_WEIGHT_KG.berries + 1e-6));
}

/** Moves the clock on. The game is paused first, so the player stays put. */
function skipMinutes(game: Game, minutes: number): void {
  send(game, { type: "setPaused", paused: true });
  send(game, { type: "skipTime", hours: minutes / 60 });
}

/** Unpauses the game, so the player can reach for things again after skipping time. */
function resume(game: Game): void {
  game.client.send({ type: "setPaused", paused: false });
}

/** A grid point a few metres from the player, with open ground all round it. */
function openSpotNearPlayer(game: Game): { x: number; z: number } {
  const player = onlyPlayer(game);
  for (let distance = 3; distance < 30; distance += 1) {
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [0, -1],
      [-1, 0],
    ] as const) {
      const spot = { x: Math.round(player.position.x + dx * distance), z: Math.round(player.position.z + dz * distance) };
      const open = [-2, -1, 0, 1, 2].every((ax) => [-2, -1, 0, 1, 2].every((az) => isWalkable(game.walkMap, { x: spot.x + ax, z: spot.z + az })));
      if (open) return spot;
    }
  }
  throw new Error("No open spot");
}

function give(game: Game, content: BackpackContent, count: number): void {
  const backpack = onlyPlayer(game).backpack.contents;
  backpack[content] = (backpack[content] ?? 0) + count;
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

function runSeconds(game: Game, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * STEPS_PER_SECOND); i += 1) game.step();
}

function onlyPlayer(game: Game) {
  const player = game.entities.with("player", "position", "needs", "backpack").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
