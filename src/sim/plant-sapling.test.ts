import { describe, expect, it } from "bun:test";
import type { Command } from "./api-commands";
import type { Entity } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import type { GroundPoint } from "./ground-point";
import { createNeeds } from "./needs";
import { PLANT_SECONDS, SAPLING_STRUCTURE_CLEARANCE_METRES } from "./planting";
import { widenRect } from "./structure-kind";
import { TREE_WALK_BLOCK_RADIUS_METRES } from "./tree-size";
import { readSave, SAPLINGS_SAVE_VERSION, writeSave } from "./save";
import { isRiverBank } from "./river-bank-work";
import { finishReach } from "./test-steps";
import { isWalkable } from "./walk-map";

describe("planting a sapling", () => {
  it("takes a few seconds, uses one sapling from the backpack, and leaves a sapling growing from the ground", () => {
    const game = gameWithSaplings(2);
    const spot = plantableSpot(game);
    expect(game.client.refusal(plant(spot))).toBeNull();

    game.client.send(plant(spot));
    stepUntil(game, () => game.client.getView().action?.kind === "plant");
    expect(game.client.getView().backpack.sapling).toBe(2);
    stepUntil(game, () => game.client.getView().action === null);

    expect(PLANT_SECONDS).toBeGreaterThanOrEqual(2);
    expect(PLANT_SECONDS).toBeLessThanOrEqual(6);
    expect(game.client.getView().backpack.sapling).toBe(1);
    const sapling = plantedAt(game, spot);
    expect(sapling?.growth?.stage).toBe("sapling");
    expect(sapling?.stump).toBeUndefined();
  });

  it("does not block walking", () => {
    const game = gameWithSaplings(1);
    const spot = plantableSpot(game);
    plantAt(game, spot);

    expect(isWalkable(game.walkMap, spot)).toBe(true);
  });

  it("is refused while the backpack holds no sapling", () => {
    const game = gameWithSaplings(1);
    const spot = plantableSpot(game);
    give(game, 0);

    expect(game.client.refusal(plant(spot))).toEqual({ kind: "noSapling" });
  });

  it("can be dug up again, back into the backpack", () => {
    const game = gameWithSaplings(1);
    const spot = plantableSpot(game);
    plantAt(game, spot);
    const sapling = plantedAt(game, spot);
    if (sapling === undefined) throw new Error("Nothing was planted");
    const saplingId = idOf(game, sapling);

    expect(game.client.refusal({ type: "digUpSapling", saplingId })).toBeNull();
    game.client.send({ type: "digUpSapling", saplingId });
    stepUntil(game, () => game.entities.id(sapling) === undefined);

    expect(game.client.getView().backpack.sapling).toBe(1);
  });
});

describe("where a sapling can be planted", () => {
  it("refuses the river bank and the river", () => {
    const game = gameWithSaplings(1);
    const bank = findSpot(game, (spot) => isRiverBank(game.valley, spot));

    expect(game.client.refusal(plant(bank))).toEqual({ kind: "notPlantableGround" });
  });

  it("refuses a spot within 3 m of a tree", () => {
    const game = gameWithSaplings(1);
    const tree = nearestStanding(game);
    const near = besideTree(game, tree, 2.9);

    expect(game.client.refusal(plant(near))).toEqual({ kind: "tooCloseToTree" });
  });

  it("refuses a spot within 3 m of another sapling, and allows one just over 3 m away", () => {
    const game = gameWithSaplings(2);
    const spot = plantableSpot(game);
    plantAt(game, spot);

    expect(game.client.refusal(plant({ x: spot.x + 2.9, z: spot.z }))).toEqual({ kind: "tooCloseToTree" });
    const justOver = [
      { x: spot.x + 3.1, z: spot.z },
      { x: spot.x - 3.1, z: spot.z },
      { x: spot.x, z: spot.z + 3.1 },
      { x: spot.x, z: spot.z - 3.1 },
    ];
    expect(justOver.some((other) => game.client.refusal(plant(other)) === null)).toBe(true);
  });

  it("refuses a spot within 3 m of a stump", () => {
    const game = gameWithSaplings(1);
    const tree = nearestStanding(game);
    game.client.send({ type: "chopTree", treeId: idOf(game, tree) });
    stepUntil(game, () => tree.stump === true);
    send(game, { type: "dropLog" });

    expect(game.client.refusal(plant(besideTree(game, tree, 2)))).toEqual({ kind: "tooCloseToTree" });
  });

  it("refuses a spot on or beside a blueprint, structure, or foundation square", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    give(game, 1);
    const spot = plantableSpot(game);
    const check = game.client.checkPlacement("foundation", spot, 0);
    expect(check.allowed).toBe(true);
    send(game, { type: "placeBlueprint", structure: "foundation", turns: 0, x: check.spot.x, z: check.spot.z });

    expect(game.client.refusal(plant(check.spot))).toEqual({ kind: "tooCloseToStructure" });
    expect(game.client.refusal(plant({ x: check.spot.x + 1.2, z: check.spot.z }))).toEqual({ kind: "tooCloseToStructure" });
  });

  it("keeps a sapling far enough from a structure that the young tree it becomes never blocks walking inside it", () => {
    expect(SAPLING_STRUCTURE_CLEARANCE_METRES).toBeGreaterThan(TREE_WALK_BLOCK_RADIUS_METRES);
  });

  it("measures the clearance from every side of a structure's footprint", () => {
    expect(widenRect({ min: { x: 1, z: 2 }, max: { x: 3, z: 5 } }, 1)).toEqual({ min: { x: 0, z: 1 }, max: { x: 4, z: 6 } });
  });

  it("is allowed while the player drags a sled", () => {
    const game = gameWithSaplings(1);
    const spot = plantableSpot(game);
    game.entities.addComponent(onlyPlayer(game), "dragging", { sledId: 9999 });

    expect(game.client.refusal(plant(spot))).toBeNull();
  });

  it("keeps blueprints off a planted sapling", () => {
    const game = gameWithSaplings(1);
    const spot = plantableSpot(game);
    plantAt(game, spot);

    expect(game.client.checkPlacement("chest", spot, 0).allowed).toBe(false);
  });

  it("plants nothing when the spot is taken while the player walks there", () => {
    const game = gameWithSaplings(2);
    const spot = plantableSpot(game);
    game.client.send(plant(spot));
    game.step();
    // Another sapling appears beside the spot before the player gets there.
    game.entities.add({ growth: { stage: "sapling", minutesLeft: 100 }, position: { x: spot.x + 1, y: 0, z: spot.z } });
    for (let step = 0; step < 30 * STEPS_PER_SECOND; step += 1) game.step();

    expect(plantedAt(game, spot)).toBeUndefined();
    expect(game.client.getView().backpack.sapling).toBe(2);
  });
});

describe("a planted sapling growing", () => {
  it("becomes a young tree 2 game days after planting, which blocks walking, and a full tree 3 game days after that", () => {
    const game = gameWithSaplings(1);
    const spot = plantableSpot(game);
    plantAt(game, spot);
    const sapling = plantedAt(game, spot);
    walkAway(game, spot);

    passHours(game, 47);
    expect(sapling?.growth?.stage).toBe("sapling");
    passHours(game, 2);
    expect(sapling?.growth?.stage).toBe("youngTree");
    expect(isWalkable(game.walkMap, spot)).toBe(false);

    passHours(game, 70);
    expect(sapling?.tree).toBeUndefined();
    passHours(game, 2);
    expect(sapling?.tree).toBe(true);
    expect(sapling?.growth).toBeUndefined();
  });

  it("waits to become a young tree while the player stands on its spot, then grows once they step away", () => {
    const game = gameWithSaplings(1);
    const spot = plantableSpot(game);
    plantAt(game, spot);
    const sapling = plantedAt(game, spot);
    walkTo(game, spot);

    passHours(game, 60);
    expect(sapling?.growth?.stage).toBe("sapling");
    expect(isWalkable(game.walkMap, spot)).toBe(true);

    walkAway(game, spot);
    passHours(game, 1);
    expect(sapling?.growth?.stage).toBe("youngTree");
    expect(isWalkable(game.walkMap, spot)).toBe(false);
  });

  it("stands as a full tree on its own spot, so it is the kind and size of a tree there", () => {
    const game = gameWithSaplings(1);
    const spot = plantableSpot(game);
    plantAt(game, spot);
    walkAway(game, spot);
    passHours(game, 5 * 24 + 1);

    const grown = game.entities.with("tree", "position").entities.find((tree) => tree.position.x === spot.x && tree.position.z === spot.z);
    expect(grown).toBeDefined();
  });
});

describe("saving planted saplings", () => {
  it("saves a planted sapling and how far it has grown", () => {
    const game = gameWithSaplings(1);
    const spot = plantableSpot(game);
    plantAt(game, spot);
    walkAway(game, spot);
    passHours(game, 30);

    const loaded = reload(game);
    const sapling = plantedAt(loaded, spot);
    expect(sapling?.growth).toEqual(plantedAt(game, spot)?.growth);
    passHours(loaded, 19);
    expect(sapling?.growth?.stage).toBe("youngTree");
  });

  it("saves planting under way", () => {
    const game = gameWithSaplings(1);
    const spot = plantableSpot(game);
    game.client.send(plant(spot));
    stepUntil(game, () => game.client.getView().action?.kind === "plant");

    const loaded = reload(game);
    expect(loaded.client.getView().action?.kind).toBe("plant");
    stepUntil(loaded, () => loaded.client.getView().action === null);
    expect(plantedAt(loaded, spot)).toBeDefined();
  });

  it("loads a save from before saplings with none in the backpack, and keeps saplings dug up after loading", () => {
    const game = gameWithSaplings(0);
    const older = JSON.parse(JSON.stringify({ ...writeSave(game), version: SAPLINGS_SAVE_VERSION - 1 })) as ReturnType<typeof writeSave>;
    const loaded = readSave(older);
    if (!loaded.ok) throw new Error("The older save was rejected");
    expect(loaded.game.client.getView().backpack.sapling ?? 0).toBe(0);

    give(loaded.game, 2);
    expect(reload(loaded.game).client.getView().backpack.sapling).toBe(2);
  });
});

type Placed = Entity & { position: { x: number; y: number; z: number } };

function plant(spot: GroundPoint): Command {
  return { type: "plantSapling", x: spot.x, z: spot.z };
}

function gameWithSaplings(count: number): Game {
  const game = createGame({ seed: 42 });
  give(game, count);
  return game;
}

function give(game: Game, count: number): void {
  const backpack = onlyPlayer(game).backpack;
  if (backpack === undefined) throw new Error("No backpack");
  if (count === 0) delete backpack.contents.sapling;
  else backpack.contents.sapling = count;
}

/** The first spot near the player where a sapling may be planted, well clear of the river bank all round. */
function plantableSpot(game: Game): GroundPoint {
  const offBank = (spot: GroundPoint) => [-4, 0, 4].every((dx) => [-4, 0, 4].every((dz) => !isRiverBank(game.valley, { x: spot.x + dx, z: spot.z + dz })));
  return findSpot(game, (spot) => offBank(spot) && game.client.refusal(plant(spot)) === null);
}

/** The first of `candidates`, or else of the spots on a 1 m grid around the player, nearest first, that passes `accept`. */
function findSpot(game: Game, accept: (spot: GroundPoint) => boolean, candidates?: readonly GroundPoint[]): GroundPoint {
  const at = onlyPlayer(game).position;
  const around: GroundPoint[] = [];
  for (let dx = -40; dx <= 40; dx += 1) for (let dz = -40; dz <= 40; dz += 1) around.push({ x: Math.round(at.x) + dx, z: Math.round(at.z) + dz });
  around.sort((a, b) => Math.hypot(a.x - at.x, a.z - at.z) - Math.hypot(b.x - at.x, b.z - at.z));
  const found = (candidates ?? around).find(accept);
  if (found === undefined) throw new Error("No such spot");
  return found;
}

/** A spot this far from the tree, off the river bank. */
function besideTree(game: Game, tree: Placed, metres: number): GroundPoint {
  const { x, z } = tree.position;
  const around = [
    { x: x + metres, z },
    { x: x - metres, z },
    { x, z: z + metres },
    { x, z: z - metres },
  ];
  return findSpot(game, (spot) => !isRiverBank(game.valley, spot), around);
}

function plantAt(game: Game, spot: GroundPoint): void {
  game.client.send(plant(spot));
  stepUntil(game, () => plantedAt(game, spot) !== undefined);
}

function plantedAt(game: Game, spot: GroundPoint): Placed | undefined {
  return game.entities
    .with("position")
    .entities.find((entity) => (entity.growth !== undefined || entity.tree === true) && entity.position.x === spot.x && entity.position.z === spot.z);
}

function walkTo(game: Game, spot: GroundPoint): void {
  send(game, { type: "walkTo", x: spot.x, z: spot.z });
  stepUntil(game, () => game.client.getView().action === null && onlyPlayer(game).walkPath === undefined);
}

/** Walks the player to an open spot a few metres from `spot`. */
function walkAway(game: Game, spot: GroundPoint): void {
  const target = findSpot(game, (other) => {
    const distance = Math.hypot(other.x - spot.x, other.z - spot.z);
    return distance > 4 && distance < 8 && isWalkable(game.walkMap, other);
  });
  walkTo(game, target);
}

function nearestStanding(game: Game): Placed {
  const player = onlyPlayer(game);
  const distance = (at: { x: number; z: number }) => Math.hypot(at.x - player.position.x, at.z - player.position.z);
  const trees = game.entities.with("tree", "position").entities;
  return trees.reduce((best, candidate) => (distance(candidate.position) < distance(best.position) ? candidate : best));
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
