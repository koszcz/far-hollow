import { describe, expect, it } from "bun:test";
import type { BackpackContent, Command } from "./api";
import { nearbyOf } from "./api";
import { BACKPACK_WEIGHT_LIMIT_KG, CONTENT_WEIGHT_KG } from "./backpack";
import { FUEL_BURN_MINUTES } from "./campfires";
import type { Entity } from "./entities";
import { FIRE_JUG_MINUTES } from "./jug-on-fire";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { JUG_FIRING_SAVE_VERSION, readSave, SAVE_VERSION, writeSave, type SaveFile } from "./save";
import { CAMPFIRE_BUILD_SECONDS, CAMPFIRE_STICK_COST } from "./structures";
import { finishReach, storingPiecesOf } from "./test-steps";
import { isWalkable } from "./walk-map";

describe("firing a jug", () => {
  it("puts one unfired jug from the backpack on a lit fire, and it is a jug after 20 game minutes", () => {
    const { game, campfireId } = gameWithLitCampfire();
    give(game, "unfiredJug", 2);

    send(game, { type: "fireJug", campfireId });

    expect(game.client.getView().backpack.unfiredJug).toBe(1);
    expect(jugOnFire(game)?.fired).toBe(false);
    skipMinutes(game, FIRE_JUG_MINUTES / 2);
    expect(jugOnFire(game)?.fireProgress).toBeGreaterThan(0.45);
    expect(jugOnFire(game)?.fired).toBe(false);
    skipMinutes(game, FIRE_JUG_MINUTES / 2);
    expect(jugOnFire(game)).toEqual({ fired: true, fireProgress: 1 });
  });

  it("takes 20 game minutes", () => {
    expect(FIRE_JUG_MINUTES).toBe(20);
  });

  it("fires one jug at a time, beside the pot and the fish", () => {
    const { game, campfireId } = gameWithLitCampfire();
    give(game, "unfiredJug", 2);
    give(game, "potOfRiverWater", 1);
    give(game, "rawFish", 1);

    send(game, { type: "putPotOnFire", campfireId });
    send(game, { type: "cookFish", campfireId });
    send(game, { type: "fireJug", campfireId });
    send(game, { type: "fireJug", campfireId });

    const campfire = nearbyOf(game.client.getView(), "campfire");
    expect(campfire?.pot).not.toBeNull();
    expect(campfire?.fish).toHaveLength(1);
    expect(campfire?.jug).not.toBeNull();
    expect(game.client.getView().backpack.unfiredJug).toBe(1);
    expect(game.client.refusal({ type: "fireJug", campfireId })).toEqual({ kind: "fireHoldsJug" });
  });

  it("will not put a jug on a fire that is not lit, or without an unfired jug", () => {
    const unlit = gameWithLitCampfire();
    unlit.campfire.campfire.lit = false;
    give(unlit.game, "unfiredJug", 1);
    expect(unlit.game.client.refusal({ type: "fireJug", campfireId: unlit.campfireId })).toEqual({ kind: "lightFirst" });
    send(unlit.game, { type: "fireJug", campfireId: unlit.campfireId });
    expect(jugOnFire(unlit.game)).toBeNull();
    expect(unlit.game.client.getView().backpack.unfiredJug).toBe(1);

    const noJug = gameWithLitCampfire();
    give(noJug.game, "jug", 1);
    expect(noJug.game.client.refusal({ type: "fireJug", campfireId: noJug.campfireId })).toEqual({ kind: "noUnfiredJug" });
    send(noJug.game, { type: "fireJug", campfireId: noJug.campfireId });
    expect(jugOnFire(noJug.game)).toBeNull();
  });

  it("stops when the fire goes out, keeps the progress, and goes on when it is lit again", () => {
    const { game, campfire, campfireId } = gameWithLitCampfire("stick");
    give(game, "unfiredJug", 1);
    // A stick burns for 20 minutes. Put the jug on with a quarter of it left, so the fire goes out partway through firing.
    skipMinutes(game, FUEL_BURN_MINUTES.stick - FIRE_JUG_MINUTES / 4);
    resume(game);
    send(game, { type: "fireJug", campfireId });

    skipMinutes(game, FIRE_JUG_MINUTES * 2);
    expect(nearbyOf(game.client.getView(), "campfire")?.lit).toBe(false);
    const progressWhenOut = jugOnFire(game)?.fireProgress ?? 0;
    expect(progressWhenOut).toBeGreaterThan(0.2);
    expect(progressWhenOut).toBeLessThan(0.3);
    expect(jugOnFire(game)?.fired).toBe(false);

    skipMinutes(game, 60);
    expect(jugOnFire(game)?.fireProgress).toBe(progressWhenOut);

    resume(game);
    give(game, "firewood", 1);
    send(game, { type: "addFuel", campfireId, fuel: "firewood" });
    send(game, { type: "lightCampfire", campfireId });
    expect(campfire.campfire.lit).toBe(true);
    skipMinutes(game, (FIRE_JUG_MINUTES * 3) / 4 + 0.5);
    expect(jugOnFire(game)).toEqual({ fired: true, fireProgress: 1 });
  });
});

describe("taking a jug off the fire", () => {
  it("puts an unfired jug taken off early back in the backpack, and its progress starts from zero next time", () => {
    const { game, campfire, campfireId } = gameWithLitCampfire();
    game.entities.addComponent(campfire, "jugOnFire", { minutesFired: 15 });

    send(game, { type: "takeJugOff", campfireId });

    expect(game.client.getView().backpack.unfiredJug).toBe(1);
    expect(campfire.jugOnFire).toBeUndefined();
    expect(jugOnFire(game)).toBeNull();
    send(game, { type: "fireJug", campfireId });
    expect(jugOnFire(game)?.fireProgress).toBeLessThan(1 / FIRE_JUG_MINUTES);
  });

  it("leaves a finished jug on the fire for as long as the player likes, and takes it off as an empty jug", () => {
    const { game, campfireId } = gameWithLitCampfire();
    give(game, "unfiredJug", 1);
    send(game, { type: "fireJug", campfireId });

    skipMinutes(game, 6 * 60);
    expect(jugOnFire(game)).toEqual({ fired: true, fireProgress: 1 });

    resume(game);
    send(game, { type: "takeJugOff", campfireId });
    expect(game.client.getView().backpack.jug).toBe(1);
    expect(game.client.getView().backpack.unfiredJug ?? 0).toBe(0);
    expect(jugOnFire(game)).toBeNull();
  });

  it("leaves the jug on the fire when it does not fit in the backpack", () => {
    const { game, campfire, campfireId } = gameWithLitCampfire();
    game.entities.addComponent(campfire, "jugOnFire", { minutesFired: FIRE_JUG_MINUTES });
    fillBackpackLeaving(game, 0.5);

    send(game, { type: "takeJugOff", campfireId });

    expect(game.client.getView().backpack.jug ?? 0).toBe(0);
    expect(campfire.jugOnFire).toEqual({ minutesFired: FIRE_JUG_MINUTES });
    expect(game.client.getView().notice?.kind).toBe("backpackFull");
  });
});

describe("taking down a campfire with a jug on it", () => {
  it("is refused, and the player is told to empty it first", () => {
    const { game, campfire, campfireId } = gameWithLitCampfire();
    game.entities.addComponent(campfire, "jugOnFire", { minutesFired: 0 });
    campfire.campfire.lit = false;

    send(game, { type: "takeDown", pieceId: campfireId });
    expect(game.client.getView().notice?.kind).toBe("stillHoldsSomething");
    runSeconds(game, CAMPFIRE_BUILD_SECONDS);

    expect(game.entities.has(campfire)).toBe(true);
    expect(campfire.jugOnFire).toEqual({ minutesFired: 0 });
  });
});

describe("the empty jug", () => {
  it("weighs 1 kg", () => {
    expect(CONTENT_WEIGHT_KG.jug).toBe(1);
  });

  it("drops as a pile at the player's feet", () => {
    const game = createGame({ seed: 42 });
    give(game, "jug", 3);

    send(game, { type: "dropFromBackpack", content: "jug" });

    expect(game.client.getView().backpack.jug ?? 0).toBe(0);
    expect([...game.entities.with("pile")].map(({ pile }) => pile)).toContainEqual({ content: "jug", count: 3 });
  });
});

describe("saving firing", () => {
  it("raises the save version", () => {
    expect(JUG_FIRING_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    expect(JUG_FIRING_SAVE_VERSION).toBeGreaterThan(1);
  });

  it("keeps the jug on a campfire with its progress, and empty jugs in the backpack, a pile, and a chest", () => {
    const { game, campfire, campfireId } = gameWithLitCampfire();
    give(game, "jug", 2);
    game.entities.addComponent(campfire, "jugOnFire", { minutesFired: 7.5 });
    game.entities.add({ pile: { content: "jug", count: 3 }, position: { x: 1, y: 0, z: 1 } });
    game.entities.add({ furniture: "chest", storage: { contents: { jug: 4 } }, facing: { turns: 0 }, position: { x: 4, y: 0, z: 4 } });

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(loaded.game.entities.entity(campfireId)?.jugOnFire).toEqual({ minutesFired: 7.5 });
    expect(nearbyOf(loaded.game.client.getView(), "campfire")?.jug).toEqual({ fired: false, fireProgress: 7.5 / FIRE_JUG_MINUTES });
    expect(loaded.game.client.getView().backpack.jug).toBe(2);
    expect([...loaded.game.entities.with("pile")].map(({ pile }) => pile)).toContainEqual({ content: "jug", count: 3 });
    expect(storingPiecesOf(loaded.game.entities, "chest").map(({ storage }) => storage.contents)).toContainEqual({ jug: 4 });
  });

  it("upgrades a save from before firing unchanged", () => {
    const game = createGame({ seed: 42 });
    give(game, "unfiredJug", 2);
    const save = JSON.parse(JSON.stringify(writeSave(game))) as SaveFile;
    save.version = JUG_FIRING_SAVE_VERSION - 1;

    const loaded = readSave(save);
    if (!loaded.ok) throw new Error("The save was rejected");

    expect(writeSave(loaded.game).version).toBe(SAVE_VERSION);
    expect(loaded.game.client.getView().backpack).toEqual(onlyPlayer(game).backpack.contents);
  });
});

/** The jug on the campfire beside the player, as its panel shows it, or null if there is none. */
function jugOnFire(game: Game) {
  return nearbyOf(game.client.getView(), "campfire")?.jug ?? null;
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
