import { describe, expect, it } from "bun:test";
import { nearbyOf, type BackpackContent, type Command } from "./api";
import { addToBackpack } from "./backpack";
import { edgeMiddle } from "./edge-pieces";
import type { Entity } from "./entities";
import { foundationDeckTop } from "./foundations";
import { WOOD_BOX_BUILD_SECONDS, WOOD_BOX_FIREWOOD_LIMIT, WOOD_BOX_PLANK_COST } from "./furniture/wood-box";
import { createGame, type Game } from "./game";
import type { GroundPoint } from "./ground-point";
import type { QuarterTurns } from "./quarter-turns";
import { readSave, SAVE_VERSION, WOOD_BOXES_SAVE_VERSION, writeSave } from "./save";
import { structureOf } from "./structures";
import { addFinished, finishReach, newestBlueprint, onlyPlayer, piecesOf, stepUntil } from "./test-steps";
import { isWalkable } from "./walk-map";

describe("the wood box in the build menu", () => {
  it("lists the wood box as furniture after the rain barrel, costing 4 planks and needing no tool", () => {
    const menu = createGame({ seed: 42 }).client.getView().buildMenu;

    expect(WOOD_BOX_PLANK_COST).toBe(4);
    expect(WOOD_BOX_BUILD_SECONDS).toBe(8);
    const barrelAt = menu.findIndex(({ structure }) => structure === "rainBarrel");
    expect(menu[barrelAt + 1]).toEqual({ structure: "woodBox", cost: [{ material: "plank", count: 4 }], placement: "anywhere" });
  });
});

describe("placing a wood box", () => {
  it("goes inside a room, exactly where the mouse points, and R turns it", () => {
    const game = createGame({ seed: 42 });
    const [, second] = roomNearPlayer(game, 3);
    const at = { x: second.x + 0.1, z: second.z - 0.05 };

    const check = game.client.checkPlacement("woodBox", at, 1);

    expect(check.allowed).toBe(true);
    expect(check.spot).toMatchObject({ x: at.x, z: at.z });
    expect(check.turns).toBe(1);
  });

  it("cannot go on open ground, and says it goes only inside a room", () => {
    const game = createGame({ seed: 42 });
    const square = openSquareNearPlayer(game);

    const check = game.client.checkPlacement("woodBox", square, 0);

    expect(check.allowed).toBe(false);
    expect(check.refusal).toEqual({ kind: "needsRoom" });
  });

  it("cannot go on a foundation that is not in a room", () => {
    const game = createGame({ seed: 42 });
    const [first, second] = roomNearPlayer(game, 3);
    game.entities.remove(wallOn(game, first, 1));

    const check = game.client.checkPlacement("woodBox", second, 0);

    expect(check.allowed).toBe(false);
    expect(check.refusal).toEqual({ kind: "needsRoom" });
  });

  it("is built with held work from 4 planks, and blocks walking once finished, empty", () => {
    const game = createGame({ seed: 42 });
    const [first, second] = roomNearPlayer(game, 3);
    standOn(game, first);
    onlyPlayer(game).backpack.contents.plank = WOOD_BOX_PLANK_COST;
    game.client.send({ type: "placeBlueprint", structure: "woodBox", turns: 0, x: second.x, z: second.z });
    game.step();
    const blueprint: Entity = newestBlueprint(game, "woodBox");

    game.client.send({ type: "build", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => blueprint.blueprint === undefined);

    expect(blueprint.furniture).toBe("woodBox");
    expect(blueprint.woodBox).toEqual({ firewood: 0 });
    expect(onlyPlayer(game).backpack.contents.plank).toBe(0);
    expect(isWalkable(game.walkMap, second)).toBe(false);
  });
});

describe("taking down a wood box", () => {
  it("gives back all 4 planks once it is empty", () => {
    const { game, box } = gameWithWoodBox();
    const backpack = onlyPlayer(game).backpack;
    backpack.contents.plank = 0;

    game.client.send({ type: "takeDown", pieceId: box.id });
    stepUntil(game, () => piecesOf(game.entities, "woodBox").length === 0);

    expect(backpack.contents.plank).toBe(WOOD_BOX_PLANK_COST);
  });

  it("is refused while it holds firewood, and the player is told to empty it first", () => {
    const { game, box } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 3 };

    expect(game.client.refusal({ type: "takeDown", pieceId: box.id })).toEqual({ kind: "emptyFirst" });
    game.client.send({ type: "takeDown", pieceId: box.id });
    game.step();

    expect(piecesOf(game.entities, "woodBox")).toHaveLength(1);
    expect(game.client.getView().notice).toMatchObject({ kind: "stillHoldsSomething" });
  });

  it("takes its blueprint down at once", () => {
    const game = createGame({ seed: 42 });
    const [first, second] = roomNearPlayer(game, 3);
    standOn(game, first);
    game.client.send({ type: "placeBlueprint", structure: "woodBox", turns: 0, x: second.x, z: second.z });
    game.step();
    const blueprint = newestBlueprint(game, "woodBox");

    game.client.send({ type: "takeDown", pieceId: idOf(game, blueprint) });
    game.step();
    game.step();

    expect(game.entities.with("blueprint").size).toBe(0);
  });
});

describe("filling and emptying a wood box", () => {
  it("puts one firewood in from the backpack", () => {
    const { game, box } = gameWithWoodBox();
    give(game, "firewood", 3);

    use(game, { type: "putInWoodBox", woodBoxId: box.id, all: false });

    expect(box.entity.woodBox).toEqual({ firewood: 1 });
    expect(onlyPlayer(game).backpack.contents.firewood).toBe(2);
  });

  it("puts in all the firewood that fits", () => {
    const { game, box } = gameWithWoodBox();
    box.entity.woodBox = { firewood: WOOD_BOX_FIREWOOD_LIMIT - 4 };
    give(game, "firewood", 6);

    use(game, { type: "putInWoodBox", woodBoxId: box.id, all: true });

    expect(box.entity.woodBox).toEqual({ firewood: WOOD_BOX_FIREWOOD_LIMIT });
    expect(onlyPlayer(game).backpack.contents.firewood).toBe(2);
  });

  it("holds up to 20 firewood", () => {
    expect(WOOD_BOX_FIREWOOD_LIMIT).toBe(20);
  });

  it("takes as much firewood as fits in the backpack", () => {
    const { game, box } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 12 };
    const backpack = onlyPlayer(game).backpack;
    while (addToBackpack(backpack, "stone", 1));
    // Make room for exactly three pieces of firewood.
    for (let i = 0; i < 3; i += 1) backpack.contents.stone = (backpack.contents.stone ?? 0) - 1;
    const roomFor = countThatFits(game, "firewood");

    use(game, { type: "takeFromWoodBox", woodBoxId: box.id });

    expect(roomFor).toBeGreaterThan(0);
    expect(backpack.contents.firewood).toBe(roomFor);
    expect(box.entity.woodBox).toEqual({ firewood: 12 - roomFor });
  });

  it("takes everything when it all fits", () => {
    const { game, box } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 5 };

    use(game, { type: "takeFromWoodBox", woodBoxId: box.id });

    expect(box.entity.woodBox).toEqual({ firewood: 0 });
    expect(onlyPlayer(game).backpack.contents.firewood).toBe(5);
  });

  it("refuses each action, with the reason, when it cannot be done", () => {
    const { game, box } = gameWithWoodBox();
    const putIn: Command = { type: "putInWoodBox", woodBoxId: box.id, all: false };
    const take: Command = { type: "takeFromWoodBox", woodBoxId: box.id };

    expect(game.client.refusal(putIn)).toEqual({ kind: "noContent", content: "firewood" });
    expect(game.client.refusal(take)).toEqual({ kind: "woodBoxEmpty" });

    give(game, "firewood", 1);
    box.entity.woodBox = { firewood: WOOD_BOX_FIREWOOD_LIMIT };
    expect(game.client.refusal(putIn)).toEqual({ kind: "woodBoxFull" });

    const backpack = onlyPlayer(game).backpack;
    while (addToBackpack(backpack, "stone", 1));
    expect(game.client.refusal(take)).toEqual({ kind: "backpackFull" });
  });

  it("shows how full it is to the player beside it", () => {
    const { game, box } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 7 };
    game.step();

    expect(nearbyOf(game.client.getView(), "woodBox")).toEqual({ id: box.id, firewood: 7, limit: WOOD_BOX_FIREWOOD_LIMIT });
  });

  it("holds only firewood", () => {
    const { game, box } = gameWithWoodBox();
    give(game, "stick", 3);
    give(game, "firewood", 1);

    use(game, { type: "putInWoodBox", woodBoxId: box.id, all: true });

    expect(box.entity.woodBox).toEqual({ firewood: 1 });
    expect(onlyPlayer(game).backpack.contents.stick).toBe(3);
  });
});

describe("adding firewood to a fire in the same room", () => {
  it("takes the firewood from the wood box before the backpack", () => {
    const { game, box, fireplace } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 2 };
    give(game, "firewood", 2);

    addFirewood(game, fireplace);

    expect(box.entity.woodBox).toEqual({ firewood: 1 });
    expect(onlyPlayer(game).backpack.contents.firewood).toBe(2);
    expect(fireplace.entity.fireplace?.fuelMinutes).toBeGreaterThan(0);
  });

  it("takes from the backpack once no wood box in the room holds firewood", () => {
    const { game, box, fireplace } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 1 };
    give(game, "firewood", 2);

    addFirewood(game, fireplace);
    addFirewood(game, fireplace);

    expect(box.entity.woodBox).toEqual({ firewood: 0 });
    expect(onlyPlayer(game).backpack.contents.firewood).toBe(1);
  });

  it("is offered when only the wood box holds firewood, and refused with the reason when neither does", () => {
    const { game, box, fireplace } = gameWithWoodBox();
    const command: Command = { type: "addFuel", campfireId: fireplace.id, fuel: "firewood" };
    expect(game.client.refusal(command)).toEqual({ kind: "noContent", content: "firewood" });

    box.entity.woodBox = { firewood: 1 };
    expect(game.client.refusal(command)).toBeNull();
  });

  it("is refused while the fire is full, even with firewood in the box", () => {
    const { game, box, fireplace } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 5 };
    if (fireplace.entity.fireplace === undefined) throw new Error("No fire");
    fireplace.entity.fireplace.fuelMinutes = 16 * 60;

    expect(game.client.refusal({ type: "addFuel", campfireId: fireplace.id, fuel: "firewood" })).toEqual({ kind: "fireFull" });
  });

  it("takes from the wood box nearest the fire", () => {
    const game = createGame({ seed: 42 });
    const squares = roomNearPlayer(game, 4);
    const [first, second, third, fourth] = squares;
    if (third === undefined || fourth === undefined) throw new Error("A short room");
    const fireplace = addFinished(game, "fireplace", first, 0);
    const far = addFinished(game, "woodBox", fourth, 0);
    const near = addFinished(game, "woodBox", third, 0);
    far.entity.woodBox = { firewood: 4 };
    near.entity.woodBox = { firewood: 4 };
    standOn(game, second);

    addFirewood(game, fireplace);

    expect(near.entity.woodBox).toEqual({ firewood: 3 });
    expect(far.entity.woodBox).toEqual({ firewood: 4 });
  });

  it("takes from a campfire on a foundation in the room too", () => {
    const game = createGame({ seed: 42 });
    const [first, second, third] = roomNearPlayer(game, 3);
    if (third === undefined) throw new Error("A short room");
    const campfire = addFinished(game, "campfire", first, 0);
    const box = addFinished(game, "woodBox", third, 0);
    box.entity.woodBox = { firewood: 2 };
    standOn(game, second);

    addFirewood(game, campfire);

    expect(box.entity.woodBox).toEqual({ firewood: 1 });
    expect(campfire.entity.campfire?.fuelMinutes).toBeGreaterThan(0);
  });

  it("does not walk the player to the wood box", () => {
    const { game, box, fireplace } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 2 };
    const before = { ...onlyPlayer(game).position };

    addFirewood(game, fireplace);

    expect(onlyPlayer(game).position).toMatchObject({ x: before.x, z: before.z });
  });

  it("takes each queued piece from the box first", () => {
    const { game, box, fireplace } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 2 };
    give(game, "firewood", 1);
    const command: Command = { type: "addFuel", campfireId: fireplace.id, fuel: "firewood" };

    for (let i = 0; i < 3; i += 1) game.client.send({ type: "queueAction", action: command });
    game.step();
    stepUntil(game, () => game.client.getView().actionQueue.length === 0 && game.client.getView().reach === null);

    expect(box.entity.woodBox).toEqual({ firewood: 0 });
    expect(onlyPlayer(game).backpack.contents.firewood).toBe(0);
  });

  it("serves no fire in another room or out in the open", () => {
    const game = createGame({ seed: 42 });
    const [first, second, third] = roomNearPlayer(game, 3);
    if (third === undefined) throw new Error("A short room");
    const box = addFinished(game, "woodBox", third, 0);
    box.entity.woodBox = { firewood: 3 };
    standOn(game, second);
    // A wall across the room splits it in two, so the box and the fire stand in different rooms.
    addEdge(game, second, 3);
    const fireplace = addFinished(game, "fireplace", first, 0);
    standOn(game, first);

    expect(game.client.refusal({ type: "addFuel", campfireId: fireplace.id, fuel: "firewood" })).toEqual({ kind: "noContent", content: "firewood" });
  });

  it("keeps its firewood when the room breaks, and serves no fire until the room is whole again", () => {
    const { game, box, fireplace, squares } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 3 };
    const command: Command = { type: "addFuel", campfireId: fireplace.id, fuel: "firewood" };
    const wall = wallOn(game, squares[0], 1);
    const wallParts = { ...wall };
    game.entities.remove(wall);

    expect(game.client.refusal(command)).toEqual({ kind: "noContent", content: "firewood" });
    expect(box.entity.woodBox).toEqual({ firewood: 3 });

    game.entities.add(wallParts);
    expect(game.client.refusal(command)).toBeNull();
  });

  it("never fuels or relights a fire on its own", () => {
    const { game, box, fireplace } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 3 };

    game.client.send({ type: "skipTime", hours: 4 });
    game.step();

    expect(box.entity.woodBox).toEqual({ firewood: 3 });
    expect(fireplace.entity.fireplace).toEqual({ lit: false, fuelMinutes: 0 });
  });

  it("still takes sticks and bark only from the backpack", () => {
    const { game, box, fireplace } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 3 };

    expect(game.client.refusal({ type: "addFuel", campfireId: fireplace.id, fuel: "stick" })).toEqual({ kind: "noContent", content: "stick" });
    expect(game.client.refusal({ type: "addFuel", campfireId: fireplace.id, fuel: "bark" })).toEqual({ kind: "noContent", content: "bark" });
  });
});

describe("saving wood boxes", () => {
  it("raises the save version for wood boxes, and loads a save from before then", () => {
    const game = createGame({ seed: 42 });
    expect(WOOD_BOXES_SAVE_VERSION).toBeLessThanOrEqual(SAVE_VERSION);
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { version: number };
    save.version = WOOD_BOXES_SAVE_VERSION - 1;

    expect(readSave(save).ok).toBe(true);
  });

  it("keeps a wood box's spot, facing, and firewood, and its blueprint", () => {
    const { game, box, squares } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 9 };
    standOn(game, squares[1]);
    game.client.send({ type: "placeBlueprint", structure: "woodBox", turns: 2, x: squares[1].x, z: squares[1].z + 0.1 });
    game.step();

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));
    if (!loaded.ok) throw new Error("The save did not load");

    const [saved] = piecesOf(loaded.game.entities, "woodBox");
    expect(saved?.position).toMatchObject({ x: box.position.x, z: box.position.z });
    expect(saved?.woodBox).toEqual({ firewood: 9 });
    expect(loaded.game.entities.with("blueprint").entities.map(({ blueprint }) => blueprint.structure)).toEqual(["woodBox"]);
  });

  it("keeps a walk to put firewood in a wood box", () => {
    const { game, box, squares } = gameWithWoodBox();
    give(game, "firewood", 2);
    standOn(game, { x: squares[0].x - 6, z: squares[0].z });
    game.client.send({ type: "putInWoodBox", woodBoxId: box.id, all: true });
    game.step();

    const loaded = readSave(JSON.parse(JSON.stringify(writeSave(game))));

    expect(loaded.ok).toBe(true);
  });

  it("turns away a wood box with more firewood than it holds", () => {
    const { game, box } = gameWithWoodBox();
    box.entity.woodBox = { firewood: 4 };
    const save = JSON.parse(JSON.stringify(writeSave(game))) as { entities: { components: Record<string, unknown> }[] };
    const saved = save.entities.find(({ components }) => components.furniture === "woodBox");
    if (saved === undefined) throw new Error("No saved wood box");
    saved.components.woodBox = { firewood: WOOD_BOX_FIREWOOD_LIMIT + 1 };

    expect(readSave(save).ok).toBe(false);
  });
});

type Finished = ReturnType<typeof addFinished>;

/** A room of three squares: a fireplace on the first, the player on the second, and an empty wood box on the third. */
function gameWithWoodBox(): { game: Game; box: Finished; fireplace: Finished; squares: [GroundPoint, GroundPoint, GroundPoint] } {
  const game = createGame({ seed: 42 });
  const [first, second, third] = roomNearPlayer(game, 3);
  if (third === undefined) throw new Error("A short room");
  const fireplace = addFinished(game, "fireplace", first, 0);
  const box = addFinished(game, "woodBox", third, 0);
  standOn(game, second);
  return { game, box, fireplace, squares: [first, second, third] };
}

/** Adds one piece of firewood to the fire, from beside it, and waits for the reach to end. */
function addFirewood(game: Game, fire: Finished): void {
  game.client.send({ type: "addFuel", campfireId: fire.id, fuel: "firewood" });
  game.step();
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
  finishReach(game);
}

/** Sends a command on the wood box and waits for the player to walk there and finish the reach. */
function use(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
  finishReach(game);
  finishReach(game);
}

/** How many more of a content fit in the player's backpack. */
function countThatFits(game: Game, content: BackpackContent): number {
  const backpack = structuredClone(onlyPlayer(game).backpack);
  let count = 0;
  while (addToBackpack(backpack, content, 1)) count += 1;
  return count;
}

function give(game: Game, content: BackpackContent, count: number): void {
  const contents = onlyPlayer(game).backpack.contents;
  contents[content] = (contents[content] ?? 0) + count;
}

/**
 * Builds a finished room of `length` foundation squares in a row along +x near the player, with log walls all round and a roof
 * on every square. Returns the squares' middles, in order.
 */
function roomNearPlayer(game: Game, length: number): [GroundPoint, GroundPoint, ...GroundPoint[]] {
  const start = openSquareNearPlayer(game);
  const squares = Array.from({ length }, (_, i) => ({ x: start.x + i, z: start.z }));
  const deck = (square: GroundPoint) => ({ x: square.x, y: foundationDeckTop(game.valley.terrain, square), z: square.z });
  for (const square of squares) game.entities.add({ foundation: true, facing: { turns: 0 }, position: deck(square) });
  squares.forEach((square, i) => {
    const sides: QuarterTurns[] = [0, 2];
    if (i === 0) sides.push(1);
    if (i === length - 1) sides.push(3);
    for (const side of sides) addEdge(game, square, side);
  });
  for (const square of squares) game.entities.add({ ...structureOf("roof").finish(square, 0, game.entities), facing: { turns: 0 }, position: deck(square) });
  const [first, second, ...rest] = squares;
  if (first === undefined || second === undefined) throw new Error("A room here needs at least two squares");
  return [first, second, ...rest];
}

/** Adds a finished log wall on one side of a square. */
function addEdge(game: Game, square: GroundPoint, side: QuarterTurns): void {
  const edge = edgeMiddle(square, side);
  game.entities.add({ ...structureOf("logWall").finish(edge, side, game.entities), facing: { turns: side }, position: { x: edge.x, y: 0, z: edge.z } });
}

function wallOn(game: Game, square: GroundPoint, side: QuarterTurns): Entity {
  const edge = edgeMiddle(square, side);
  const wall = game.entities
    .with("edgePiece", "position")
    .entities.find(({ position }) => Math.abs(position.x - edge.x) < 1e-6 && Math.abs(position.z - edge.z) < 1e-6);
  if (wall === undefined) throw new Error("No wall there");
  return wall;
}

/** Puts the player straight onto a spot, as if they had walked there. */
function standOn(game: Game, spot: GroundPoint): void {
  const player = onlyPlayer(game);
  player.position = { x: spot.x, y: foundationDeckTop(game.valley.terrain, spot), z: spot.z };
  player.previousPosition = { ...player.position };
}

/** The middle of a building-grid square a few metres from the player, with open ground three squares all round it. */
function openSquareNearPlayer(game: Game): GroundPoint {
  const player = onlyPlayer(game);
  for (let distance = 4; distance < 30; distance += 1) {
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [0, -1],
      [-1, 0],
    ] as const) {
      const square = { x: Math.floor(player.position.x + dx * distance) + 0.5, z: Math.floor(player.position.z + dz * distance) + 0.5 };
      const reach = [-3, -2, -1, 0, 1, 2, 3, 4, 5];
      const open = reach.every((ax) => reach.every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })));
      if (open && game.client.checkPlacement("foundation", square, 0).allowed) return square;
    }
  }
  throw new Error("No open square");
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
