import { describe, expect, it } from "bun:test";
import type { Command } from "./api";
import type { Entity } from "./entities";
import { foundationDeckTop } from "./foundations";
import { createGame, type Game } from "./game";
import type { GroundPoint } from "./ground-point";
import type { QuarterTurns } from "./quarter-turns";
import { addFinished, onlyPlayer, openFoundation, stepUntil } from "./test-steps";

// Reach never crosses a wall: the player acts on a thing only from the thing's side of every log wall and window.
// The tests build a cabin of 3 by 3 foundation squares, walled all round. Its west wall, on the -x side, has a log wall or a
// window in its middle. Its east wall, on the +x side, has a door frame in its middle, or a log wall for a cabin with no way in.

/** What stands in the middle of the cabin's east wall. */
type EastDoorway = "doorFrame" | "doorAndFrame" | "logWall";
/** What stands in the middle of the cabin's west wall. */
type WestMiddle = "logWall" | "window";

interface Cabin {
  /** The middle of the cabin's middle square. */
  readonly middle: GroundPoint;
  /** The piece in the middle of the west wall. */
  readonly west: Entity & { position: GroundPoint };
  /** The piece in the middle of the east wall. */
  readonly east: Entity & { position: GroundPoint };
}

function buildCabin(game: Game, { east = "doorFrame", west = "logWall" }: { east?: EastDoorway; west?: WestMiddle } = {}): Cabin {
  const middle = openFoundation(game, 8);
  for (const dx of [-1, 0, 1]) {
    for (const dz of [-1, 0, 1]) {
      if (dx === 0 && dz === 0) continue;
      const square = { x: middle.x + dx, z: middle.z + dz };
      game.entities.add({ foundation: true, facing: { turns: 0 }, position: { x: square.x, y: foundationDeckTop(game.valley.terrain, square), z: square.z } });
    }
  }
  let westPiece: (Entity & { position: GroundPoint }) | undefined;
  let eastPiece: (Entity & { position: GroundPoint }) | undefined;
  const wallOn = (dx: number, dz: number, side: QuarterTurns) => {
    const square = { x: middle.x + dx, z: middle.z + dz };
    const isWestMiddle = side === 1 && dz === 0;
    const isEastMiddle = side === 3 && dz === 0;
    const kind = isWestMiddle ? west : isEastMiddle ? (east === "logWall" ? "logWall" : "doorFrame") : "logWall";
    const piece = addFinished(game, kind, square, side).entity;
    if (isWestMiddle) westPiece = piece;
    if (isEastMiddle) eastPiece = piece;
  };
  for (const d of [-1, 0, 1]) {
    wallOn(d, 1, 0);
    wallOn(d, -1, 2);
    wallOn(-1, d, 1);
    wallOn(1, d, 3);
  }
  if (westPiece === undefined || eastPiece === undefined) throw new Error("No middle pieces");
  if (east === "doorAndFrame") addFinished(game, "door", eastPiece.position, 3);
  return { middle, west: westPiece, east: eastPiece };
}

/** Puts the player at a spot, standing still. */
function standAt(game: Game, at: GroundPoint): void {
  const player = onlyPlayer(game);
  player.position.x = at.x;
  player.position.z = at.z;
  game.entities.removeComponent(player, "walkPath");
}

/** Just outside the middle of the cabin's west wall. */
const outsideWest = ({ middle }: Cabin) => ({ x: middle.x - 2, z: middle.z });
/** Just outside the middle of the cabin's east wall, by its doorway. */
const outsideEast = ({ middle }: Cabin) => ({ x: middle.x + 2, z: middle.z });
/** Inside the cabin, on the square beside the middle of its west wall. */
const insideWest = ({ middle }: Cabin) => ({ x: middle.x - 1, z: middle.z });
/** Inside the cabin, on the square beside the middle of its east wall. */
const insideEast = ({ middle }: Cabin) => ({ x: middle.x + 1, z: middle.z });

function isInside({ middle }: Cabin, at: GroundPoint): boolean {
  return Math.abs(at.x - middle.x) < 1.5 && Math.abs(at.z - middle.z) < 1.5;
}

type Stool = Entity & { position: { x: number; y: number; z: number } };

function addStool(game: Game, at: GroundPoint): Stool {
  return game.entities.add<Stool>({ furniture: "stool", position: { x: at.x, y: 0, z: at.z }, facing: { turns: 0 } });
}

function addStick(game: Game, at: GroundPoint): Entity {
  return game.entities.add({ stick: true, position: { x: at.x, y: 0, z: at.z } });
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("No id");
  return id;
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
}

describe("what blocks reach", () => {
  it("is a finished log wall: E skips a stool just behind one", () => {
    const game = createGame({ seed: 42 });
    const cabin = buildCabin(game);
    addStool(game, { x: cabin.middle.x - 0.8, z: cabin.middle.z });
    standAt(game, outsideWest(cabin));

    expect(game.client.nearestInReach()).toBeNull();
  });

  it("is a finished window: E skips a stool just behind one", () => {
    const game = createGame({ seed: 42 });
    const cabin = buildCabin(game, { west: "window" });
    addStool(game, { x: cabin.middle.x - 0.8, z: cabin.middle.z });
    standAt(game, outsideWest(cabin));

    expect(game.client.nearestInReach()).toBeNull();
  });

  it("is not an empty door frame: E reaches a stool beyond one", () => {
    const game = createGame({ seed: 42 });
    const cabin = buildCabin(game);
    const stool = addStool(game, { x: cabin.middle.x + 0.8, z: cabin.middle.z });
    standAt(game, outsideEast(cabin));

    expect(game.client.nearestInReach()).toEqual({ kind: "furniture", id: idOf(game, stool), furniture: "stool" });
  });

  it("is not a door frame with a door: E reaches a stool beyond one", () => {
    const game = createGame({ seed: 42 });
    const cabin = buildCabin(game, { east: "doorAndFrame" });
    const stool = addStool(game, { x: cabin.middle.x + 0.8, z: cabin.middle.z });
    standAt(game, outsideEast(cabin));

    expect(game.client.nearestInReach()).toEqual({ kind: "furniture", id: idOf(game, stool), furniture: "stool" });
  });

  it("is not a half-built log wall: the player sits on a stool beyond one at once", () => {
    const game = createGame({ seed: 42 });
    const middle = openFoundation(game, 8);
    send(game, { type: "placeBlueprint", structure: "logWall", turns: 1, ...middle });
    const wall = game.entities.with("blueprint").entities.at(-1);
    if (wall === undefined) throw new Error("No blueprint");
    wall.blueprint.progress = 0.5;
    wall.blueprint.materialsSpent = 2;
    const stool = addStool(game, { x: middle.x, z: middle.z });
    standAt(game, { x: middle.x - 1.5, z: middle.z });

    send(game, { type: "sitOnStool", stoolId: idOf(game, stool) });
    expect(onlyPlayer(game).approach).toBeUndefined();
    expect(game.client.getView().sittingOn).toBe(idOf(game, stool));
  });
});

describe("E with a nearer thing behind a wall", () => {
  it("acts on the further thing on the player's side", () => {
    const game = createGame({ seed: 42 });
    const cabin = buildCabin(game);
    addStool(game, { x: cabin.middle.x - 1, z: cabin.middle.z });
    const stick = addStick(game, { x: cabin.middle.x - 2, z: cabin.middle.z + 1.6 });
    standAt(game, { x: cabin.middle.x - 2, z: cabin.middle.z });

    expect(game.client.nearestInReach()).toEqual({ kind: "stick", id: idOf(game, stick) });
  });
});

describe("an edge piece never blocks reach to itself", () => {
  it("lets the player reach shutters on a window from either side", () => {
    const game = createGame({ seed: 42 });
    const cabin = buildCabin(game, { west: "window" });
    const shutters = addFinished(game, "shutters", cabin.west.position, 1);

    standAt(game, outsideWest(cabin));
    expect(game.client.nearestInReach()).toEqual({ kind: "shutters", id: shutters.id });
    standAt(game, insideWest(cabin));
    expect(game.client.nearestInReach()).toEqual({ kind: "shutters", id: shutters.id });
  });

  it("lets the player build a window in place of a log wall from inside and from outside", () => {
    for (const side of ["inside", "outside"] as const) {
      const game = createGame({ seed: 42 });
      const cabin = buildCabin(game);
      standAt(game, side === "inside" ? insideWest(cabin) : outsideWest(cabin));
      send(game, { type: "placeBlueprint", structure: "window", turns: 1, ...insideWest(cabin) });
      const blueprint = game.entities.with("blueprint", "position").entities.at(-1);
      if (blueprint === undefined) throw new Error("No blueprint");

      expect(game.client.nearestInReach()).toEqual({ kind: "blueprint", id: idOf(game, blueprint) });
    }
  });
});

describe("acting on a thing behind a wall", () => {
  it("walks the player round, in through the door frame, before they sit on a stool inside", () => {
    const game = createGame({ seed: 42 });
    const cabin = buildCabin(game);
    const stool = addStool(game, { x: cabin.middle.x - 0.8, z: cabin.middle.z });
    standAt(game, outsideWest(cabin));

    send(game, { type: "sitOnStool", stoolId: idOf(game, stool) });
    expect(game.client.getView().sittingOn).toBeNull();
    const passed: GroundPoint[] = [];
    stepUntil(game, () => {
      passed.push({ ...onlyPlayer(game).position });
      return onlyPlayer(game).approach === undefined;
    });

    expect(game.client.getView().sittingOn).toBe(idOf(game, stool));
    expect(isInside(cabin, onlyPlayer(game).position)).toBe(true);
    // They came in by the east doorway.
    expect(passed.some((at) => Math.abs(at.x - (cabin.middle.x + 1.5)) < 0.5 && Math.abs(at.z - cabin.middle.z) < 0.5)).toBe(true);
  });

  it("starts the sleep on the bed's side of the wall, for a bed against the wall", () => {
    const game = createGame({ seed: 42 });
    const cabin = buildCabin(game);
    // A bed along the west wall, its long side against it.
    const bed = addFinished(game, "bed", { x: cabin.middle.x - 1, z: cabin.middle.z }, 0);
    standAt(game, outsideWest(cabin));

    send(game, { type: "sleepInBed", bedId: bed.id });
    stepUntil(game, () => game.client.getView().lastSleep !== null);

    expect(isInside(cabin, onlyPlayer(game).position)).toBe(true);
  });

  it("refuses, with no act through the wall, when no way leads into the cabin", () => {
    const game = createGame({ seed: 42 });
    const cabin = buildCabin(game, { east: "logWall" });
    const stool = addStool(game, { x: cabin.middle.x - 0.8, z: cabin.middle.z });
    standAt(game, outsideWest(cabin));

    send(game, { type: "sitOnStool", stoolId: idOf(game, stool) });
    expect(game.client.getView().notice).toEqual({ kind: "cantGetThere" });
    for (let i = 0; i < 300; i += 1) game.step();

    expect(game.client.getView().sittingOn).toBeNull();
    expect(isInside(cabin, onlyPlayer(game).position)).toBe(false);
  });

  it("builds a blueprint inside the cabin only from inside", () => {
    const game = createGame({ seed: 42 });
    const cabin = buildCabin(game);
    standAt(game, insideWest(cabin));
    send(game, { type: "placeBlueprint", structure: "fireplace", turns: 1, x: cabin.middle.x - 1, z: cabin.middle.z + 1 });
    const blueprint = game.entities.with("blueprint", "position").entities.at(-1);
    if (blueprint === undefined) throw new Error("No blueprint");
    onlyPlayer(game).backpack.contents = { stone: 20 };
    standAt(game, { x: cabin.middle.x - 2, z: cabin.middle.z + 1 });

    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => game.client.getView().action?.kind === "build");

    expect(isInside(cabin, onlyPlayer(game).position)).toBe(true);
  });

  it("brings each log fetched from inside round to the blueprint's side of the wall", () => {
    const game = createGame({ seed: 42 });
    const cabin = buildCabin(game);
    // A sawhorse blueprint just outside the west wall, and the debarked logs for it inside, by the doorway.
    const at = { x: cabin.middle.x - 2.5, z: cabin.middle.z - 0.5 };
    send(game, { type: "placeBlueprint", structure: "sawhorse", turns: 1, ...at });
    const blueprint = game.entities.with("blueprint", "position").entities.at(-1);
    if (blueprint?.blueprint.structure !== "sawhorse") throw new Error("No sawhorse blueprint");
    for (const dz of [-0.6, 0, 0.6]) game.entities.add({ debarkedLog: { heading: 0 }, position: { x: cabin.middle.x + 1, y: 0, z: cabin.middle.z + dz } });
    standAt(game, insideEast(cabin));

    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    const parts = blueprint.blueprint;
    let spent = 0;
    stepUntil(game, () => {
      // A log counts once the hand gives it over, as delivered, or once construction spends it.
      const now = parts.materialsSpent + (parts.delivered.debarkedLog ?? 0);
      if (now > spent) {
        spent = now;
        expect(isInside(cabin, onlyPlayer(game).position)).toBe(false);
      }
      return spent >= 2;
    });
  });
});
