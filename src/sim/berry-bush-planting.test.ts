import { describe, expect, it } from "bun:test";
import type { Command } from "./api";
import type { Entity } from "./entities";
import { createGame, type Game } from "./game";
import type { GroundPoint } from "./ground-point";
import { createNeeds } from "./needs";
import { DIG_UP_SECONDS } from "./digging-up";
import { BERRY_BUSHES_SAVE_VERSION, readSave, SAVE_VERSION, writeSave } from "./save";
import { isRiverBank } from "./stone";
import { finishReach } from "./test-steps";

describe("digging up a berry bush", () => {
  it("takes a few seconds with no tool, and puts the bush and its berries in the backpack", () => {
    const game = createGame({ seed: 42 });
    emptyBackpack(game);
    const bush = nearestBush(game);
    const bushId = idOf(game, bush);
    expect(game.client.refusal(digUp(bushId))).toBeNull();

    game.client.send(digUp(bushId));
    stepUntil(game, () => game.client.getView().action?.kind === "digUp");
    expect(game.entities.id(bush)).toBe(bushId);
    stepUntil(game, () => game.entities.id(bush) === undefined);

    expect(DIG_UP_SECONDS).toBeGreaterThanOrEqual(2);
    expect(DIG_UP_SECONDS).toBeLessThanOrEqual(6);
    expect(game.client.getView().backpack.berryBush).toBe(1);
    expect(game.client.getView().backpack.berries).toBe(3);
  });

  it("puts no berries in the backpack when the bush is growing them back", () => {
    const game = createGame({ seed: 42 });
    emptyBackpack(game);
    const bush = nearestBush(game);
    game.entities.addComponent(bush, "regrowing", { minutesLeft: 100 });

    digUpNow(game, bush);

    expect(game.client.getView().backpack.berryBush).toBe(1);
    expect(game.client.getView().backpack.berries ?? 0).toBe(0);
  });

  it("stacks bushes in the backpack, each weighing 1 kg", () => {
    const game = createGame({ seed: 42 });
    emptyBackpack(game);
    const first = nearestBush(game);
    game.entities.addComponent(first, "regrowing", { minutesLeft: 100 });
    digUpNow(game, first);
    const second = nearestBush(game);
    game.entities.addComponent(second, "regrowing", { minutesLeft: 100 });
    digUpNow(game, second);

    expect(game.client.getView().backpack.berryBush).toBe(2);
    expect(game.client.getView().backpackWeight).toBeCloseTo(2);
  });

  it("is refused with the reason when the bush and its berries do not fit in the backpack", () => {
    const game = createGame({ seed: 42 });
    // 18.8 kg: the bush would fit, but not with its berries.
    setBackpack(game, { stone: 9, stick: 1, bark: 1 });
    const bush = nearestBush(game);

    expect(game.client.refusal(digUp(idOf(game, bush)))).toEqual({ kind: "backpackFull" });
  });

  it("is gone from its spot for good, after saving and loading too", () => {
    const game = createGame({ seed: 42 });
    emptyBackpack(game);
    const bush = nearestBush(game);
    const spot = { x: bush.position.x, z: bush.position.z };
    digUpNow(game, bush);

    const loaded = reload(game);
    expect(bushAt(loaded, spot)).toBeUndefined();
    expect(loaded.client.getView().backpack.berryBush).toBe(1);
  });

  it("refuses a mushroom patch", () => {
    const game = createGame({ seed: 42 });
    const patch = game.entities.with("forageSpot", "position").entities.find(({ forageSpot }) => forageSpot.food === "mushroom");
    if (patch === undefined) throw new Error("No mushroom patch");

    expect(game.client.refusal(digUp(idOf(game, patch)))).toEqual({ kind: "gone" });
  });
});

describe("planting a berry bush", () => {
  it("takes a few seconds, uses one bush from the backpack, and leaves a bush with no berries yet", () => {
    const game = gameWithBushes(2);
    const spot = plantableSpot(game);
    expect(game.client.refusal(plant(spot))).toBeNull();

    game.client.send(plant(spot));
    stepUntil(game, () => game.client.getView().action?.kind === "plant");
    stepUntil(game, () => game.client.getView().action === null);

    expect(game.client.getView().backpack.berryBush).toBe(1);
    const bush = bushAt(game, spot);
    expect(bush?.forageSpot).toEqual({ food: "berries" });
    expect(bush?.blocksWalking).toBeUndefined();
    expect(game.client.refusal({ type: "forage", spotId: idOf(game, bush ?? {}) })).toEqual({ kind: "nothingToTake" });
  });

  it("is refused while the backpack holds no berry bush", () => {
    const game = gameWithBushes(0);
    const spot = findSpot(game, (at) => game.client.refusal(plant(at))?.kind === "noBerryBush");

    expect(game.client.refusal(plant(spot))).toEqual({ kind: "noBerryBush" });
  });

  it("bears its first berries 2 days after planting, then grows them back like a wild bush", () => {
    const game = gameWithBushes(1);
    const spot = plantableSpot(game);
    plantAt(game, spot);
    const bush = bushAt(game, spot);
    if (bush === undefined) throw new Error("Nothing was planted");
    const spotId = idOf(game, bush);

    passHours(game, 47);
    expect(game.client.refusal({ type: "forage", spotId })).toEqual({ kind: "nothingToTake" });
    passHours(game, 2);
    expect(game.client.refusal({ type: "forage", spotId })).toBeNull();

    game.client.send({ type: "forage", spotId });
    stepUntil(game, () => bush.regrowing !== undefined);
    expect(game.client.getView().backpack.berries).toBe(3);
    passHours(game, 71);
    expect(game.client.refusal({ type: "forage", spotId })).toEqual({ kind: "nothingToTake" });
    passHours(game, 2);
    expect(game.client.refusal({ type: "forage", spotId })).toBeNull();
  });

  it("can be dug up again, back into the backpack", () => {
    const game = gameWithBushes(1);
    const spot = plantableSpot(game);
    plantAt(game, spot);
    const bush = bushAt(game, spot);
    if (bush === undefined) throw new Error("Nothing was planted");

    digUpNow(game, bush);

    expect(game.client.getView().backpack.berryBush).toBe(1);
  });
});

describe("where a berry bush can be planted", () => {
  it("refuses the river bank", () => {
    const game = gameWithBushes(1);
    const bank = findSpot(game, (spot) => isRiverBank(game.valley, spot));

    expect(game.client.refusal(plant(bank))).toEqual({ kind: "notPlantableGround" });
  });

  it("refuses a spot within 1 m of a tree, and allows one just over 1 m away", () => {
    const game = gameWithBushes(1);
    const tree = game.entities.with("tree", "position").entities.find((candidate) => {
      const { x, z } = candidate.position;
      return [0.9, 1.1].every((metres) => !isRiverBank(game.valley, { x: x + metres, z })) && isClearAround(game, { x: x + 1.1, z }, candidate);
    });
    if (tree === undefined) throw new Error("No tree in the open");
    const { x, z } = tree.position;

    expect(game.client.refusal(plant({ x: x + 0.9, z }))).toEqual({ kind: "tooCloseToTree" });
    expect(game.client.refusal(plant({ x: x + 1.1, z }))).toBeNull();
  });

  it("refuses a spot within 1 m of another berry bush, and allows one just over 1 m away", () => {
    const game = gameWithBushes(2);
    const spot = plantableSpot(game);
    plantAt(game, spot);

    expect(game.client.refusal(plant({ x: spot.x + 0.9, z: spot.z }))).toEqual({ kind: "tooCloseToBerryBush" });
    const justOver = [
      { x: spot.x + 1.1, z: spot.z },
      { x: spot.x - 1.1, z: spot.z },
      { x: spot.x, z: spot.z + 1.1 },
      { x: spot.x, z: spot.z - 1.1 },
    ];
    expect(justOver.some((other) => game.client.refusal(plant(other)) === null)).toBe(true);
  });

  it("refuses a spot within 1 m of a mushroom log", () => {
    const game = gameWithBushes(1);
    const spot = plantableSpot(game);
    game.entities.add({ mushroomLog: { heading: 0 }, forageSpot: { food: "mushroom" }, position: { x: spot.x + 0.8, y: 0, z: spot.z } });

    expect(game.client.refusal(plant(spot))).toEqual({ kind: "tooCloseToMushroomLog" });
  });

  it("refuses a spot within 1 m of a sapling", () => {
    const game = gameWithBushes(1);
    const spot = plantableSpot(game);
    game.entities.add({ growth: { stage: "sapling", minutesLeft: 100 }, position: { x: spot.x + 0.5, y: 0, z: spot.z } });

    expect(game.client.refusal(plant(spot))).toEqual({ kind: "tooCloseToTree" });
  });

  it("refuses a spot on or within 1 m of a blueprint or foundation square", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    setBackpack(game, { berryBush: 1 });
    const spot = plantableSpot(game);
    const check = game.client.checkPlacement("foundation", spot, 0);
    expect(check.allowed).toBe(true);
    send(game, { type: "placeBlueprint", structure: "foundation", turns: 0, x: check.spot.x, z: check.spot.z });

    expect(game.client.refusal(plant(check.spot))).toEqual({ kind: "tooCloseToStructure" });
    // A foundation square is 1 m across, so this is 0.9 m outside its edge.
    expect(game.client.refusal(plant({ x: check.spot.x + 1.4, z: check.spot.z }))).toEqual({ kind: "tooCloseToStructure" });
  });
});

describe("building near a berry bush", () => {
  it("refuses a blueprint that would cover a berry bush, and says why", () => {
    const game = gameWithBushes(1);
    const spot = plantableSpot(game);
    const free = game.client.checkPlacement("foundation", spot, 0);
    expect(free.allowed).toBe(true);
    game.entities.add({ forageSpot: { food: "berries" }, position: { x: free.spot.x + 0.3, y: 0, z: free.spot.z } });

    const check = game.client.checkPlacement("foundation", spot, 0);
    expect(check.allowed).toBe(false);
    expect(check.refusal).toEqual({ kind: "berryBushInTheWay" });
    const command: Command = { type: "placeBlueprint", structure: "foundation", turns: 0, x: check.spot.x, z: check.spot.z };
    expect(game.client.refusal(command)).toEqual({ kind: "berryBushInTheWay" });
  });

  it("gives no reason for a blueprint that is allowed", () => {
    const game = gameWithBushes(1);
    const check = game.client.checkPlacement("foundation", plantableSpot(game), 0);

    expect(check.allowed).toBe(true);
    expect(check.refusal).toBeUndefined();
  });
});

describe("saving planted berry bushes", () => {
  it("saves a planted bush and the time until its first berries", () => {
    const game = gameWithBushes(1);
    const spot = plantableSpot(game);
    plantAt(game, spot);
    passHours(game, 30);

    const loaded = reload(game);
    const bush = bushAt(loaded, spot);
    expect(bush?.regrowing).toEqual(bushAt(game, spot)?.regrowing);
    passHours(loaded, 19);
    expect(loaded.client.refusal({ type: "forage", spotId: idOf(loaded, bush ?? {}) })).toBeNull();
  });

  it("saves planting and digging up under way", () => {
    const game = gameWithBushes(1);
    const spot = plantableSpot(game);
    game.client.send(plant(spot));
    stepUntil(game, () => game.client.getView().action?.kind === "plant");

    const planting = reload(game);
    expect(planting.client.getView().action?.kind).toBe("plant");
    stepUntil(planting, () => planting.client.getView().action === null);
    const bush = bushAt(planting, spot);
    expect(bush).toBeDefined();

    planting.client.send(digUp(idOf(planting, bush ?? {})));
    stepUntil(planting, () => planting.client.getView().action?.kind === "digUp");
    const digging = reload(planting);
    expect(digging.client.getView().action?.kind).toBe("digUp");
    stepUntil(digging, () => digging.client.getView().action === null);
    expect(bushAt(digging, spot)).toBeUndefined();
    expect(digging.client.getView().backpack.berryBush).toBe(1);
  });
});

describe("loading a save from before berry bushes could be planted", () => {
  it("raises the save version", () => {
    expect(BERRY_BUSHES_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
  });

  it("keeps a sapling being dug up and a sapling being planted going", () => {
    const game = createGame({ seed: 42 });
    const player = onlyPlayer(game);
    const saved = JSON.parse(JSON.stringify({ ...writeSave(game), version: BERRY_BUSHES_SAVE_VERSION - 1 })) as {
      entities: { id: number; components: Record<string, unknown> }[];
    };
    const playerId = idOf(game, player);
    const sapling = saved.entities.find(({ id }) => id !== playerId) ?? saved.entities[0];
    const playerEntry = saved.entities.find(({ id }) => id === playerId);
    if (playerEntry === undefined || sapling === undefined) throw new Error("No player in the save");

    playerEntry.components.digUpTask = { saplingId: sapling.id, secondsDone: 1 };
    const digging = readSave(saved);
    if (!digging.ok) throw new Error("The older save was rejected");
    expect(onlyPlayer(digging.game).digUpTask).toEqual({ thingId: sapling.id, secondsDone: 1 });

    delete playerEntry.components.digUpTask;
    playerEntry.components.plantTask = { x: 1, z: 2, secondsDone: 1 };
    const planting = readSave(saved);
    if (!planting.ok) throw new Error("The older save was rejected");
    expect(onlyPlayer(planting.game).plantTask).toEqual({ x: 1, z: 2, secondsDone: 1, plant: "sapling" });
  });
});

type Placed = Entity & { position: { x: number; y: number; z: number } };

function digUp(bushId: number): Command {
  return { type: "digUpBerryBush", bushId };
}

function plant(spot: GroundPoint): Command {
  return { type: "plantBerryBush", x: spot.x, z: spot.z };
}

function gameWithBushes(count: number): Game {
  const game = createGame({ seed: 42 });
  setBackpack(game, count === 0 ? {} : { berryBush: count });
  return game;
}

function setBackpack(game: Game, contents: Record<string, number>): void {
  const backpack = onlyPlayer(game).backpack;
  if (backpack === undefined) throw new Error("No backpack");
  backpack.contents = Object.fromEntries(Object.entries(contents).filter(([, count]) => count > 0));
}

function emptyBackpack(game: Game): void {
  setBackpack(game, {});
}

function nearestBush(game: Game): Placed {
  const player = onlyPlayer(game);
  const distance = (at: GroundPoint) => Math.hypot(at.x - player.position.x, at.z - player.position.z);
  const bushes = game.entities.with("forageSpot", "position").entities.filter(({ forageSpot }) => forageSpot.food === "berries");
  const nearest = bushes.reduce<Placed | undefined>(
    (best, candidate) => (best === undefined || distance(candidate.position) < distance(best.position) ? candidate : best),
    undefined,
  );
  if (nearest === undefined) throw new Error("No berry bush");
  return nearest;
}

function digUpNow(game: Game, bush: Entity): void {
  game.client.send(digUp(idOf(game, bush)));
  stepUntil(game, () => game.entities.id(bush) === undefined);
}

function bushAt(game: Game, spot: GroundPoint): Placed | undefined {
  return game.entities.with("forageSpot", "position").entities.find((entity) => entity.position.x === spot.x && entity.position.z === spot.z);
}

/** Whether nothing but `except` stands within 3 m of the spot that would stop a bush there. */
function isClearAround(game: Game, spot: GroundPoint, except: Entity): boolean {
  const near = (entity: Placed) => entity !== except && Math.hypot(entity.position.x - spot.x, entity.position.z - spot.z) < 3;
  return !game.entities
    .with("position")
    .entities.some((entity) => (entity.tree === true || entity.forageSpot !== undefined || entity.growth !== undefined) && near(entity));
}

/** The first spot near the player where a bush may be planted, well clear of the river bank all round. */
function plantableSpot(game: Game): GroundPoint {
  const offBank = (spot: GroundPoint) => [-4, 0, 4].every((dx) => [-4, 0, 4].every((dz) => !isRiverBank(game.valley, { x: spot.x + dx, z: spot.z + dz })));
  return findSpot(game, (spot) => offBank(spot) && game.client.refusal(plant(spot)) === null && game.client.checkPlacement("foundation", spot, 0).allowed);
}

/** The first spot on a 1 m grid around the player, nearest first, that passes `accept`. */
function findSpot(game: Game, accept: (spot: GroundPoint) => boolean): GroundPoint {
  const at = onlyPlayer(game).position;
  const around: GroundPoint[] = [];
  for (let dx = -40; dx <= 40; dx += 1) for (let dz = -40; dz <= 40; dz += 1) around.push({ x: Math.round(at.x) + dx, z: Math.round(at.z) + dz });
  around.sort((a, b) => Math.hypot(a.x - at.x, a.z - at.z) - Math.hypot(b.x - at.x, b.z - at.z));
  const found = around.find(accept);
  if (found === undefined) throw new Error("No such spot");
  return found;
}

function plantAt(game: Game, spot: GroundPoint): void {
  game.client.send(plant(spot));
  stepUntil(game, () => bushAt(game, spot) !== undefined);
}

function reload(game: Game): Game {
  const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
  if (!loaded.ok) throw new Error("The save was rejected");
  return loaded.game;
}

/** Skips this many game hours, an hour at a time, with the player's needs filled before each hour. */
function passHours(game: Game, hours: number): void {
  const player = onlyPlayer(game);
  for (let hour = 0; hour < hours; hour += 1) {
    Object.assign(player.needs ?? {}, createNeeds());
    game.client.send({ type: "skipTime", hours: 1 });
    game.step();
  }
}

function stepUntil(game: Game, done: () => boolean): void {
  for (let steps = 0; !done(); steps += 1) {
    if (steps > 100_000) throw new Error("Gave up waiting");
    game.step();
  }
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
  finishReach(game);
}

function onlyPlayer(game: Game) {
  const player = game.entities.with("player", "position").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
