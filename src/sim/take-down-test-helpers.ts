import type { Command } from "./api-commands";
import { backpackWeight, CONTENT_WEIGHT_KG } from "./backpack";
import type { Entity } from "./entities";
import { foundationDeckTop } from "./foundations";
import { STEPS_PER_SECOND, type Game } from "./game";
import { type StructureKind } from "./structure-kind";
import { LEAN_TO_BARK_COST, LEAN_TO_STICK_COST } from "./structure-camp";
import { DOOR_FRAME_LOG_COST, LOG_WALL_LOG_COST, ROOF_PLANK_COST, ROOF_FRAME_LOG_COST } from "./structure-cabin-shell";
import { type QuarterTurns } from "./quarter-turns";
import { isWalkable } from "./walk-map";

/** Places a wall or door frame blueprint and builds it through to the end, delivering every debarked log it needs. */
export function finishedPieceAt(game: Game, structure: "logWall" | "doorFrame", square: { x: number; z: number }, turns: QuarterTurns): Entity {
  send(game, place(structure, square, turns));
  const blueprint = game.entities.with("blueprint", "position").entities.at(-1);
  if (blueprint?.blueprint.structure !== structure) throw new Error("The blueprint was not placed");
  const cost = structure === "logWall" ? LOG_WALL_LOG_COST : DOOR_FRAME_LOG_COST;
  for (let i = 0; i < cost; i += 1) deliverLog(game, blueprint);
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  const built: Entity = blueprint;
  stepUntil(game, () => built.blueprint === undefined);
  return blueprint;
}

/** Places a roof frame blueprint over a square, then a roof on it, and builds both through to the end. */
export function finishedRoofAt(game: Game, square: { x: number; z: number }): Entity {
  send(game, place("roofFrame", square, 0));
  const frame = game.entities.with("blueprint", "position").entities.at(-1);
  if (frame?.blueprint.structure !== "roofFrame") throw new Error("The frame was not placed");
  for (let i = 0; i < ROOF_FRAME_LOG_COST; i += 1) deliverLog(game, frame);
  send(game, { type: "build", blueprintId: idOf(game, frame) });
  const framed: Entity = frame;
  stepUntil(game, () => framed.blueprint === undefined);
  send(game, place("roof", square, 0));
  const blueprint = game.entities.with("blueprint", "position").entities.at(-1);
  if (blueprint?.blueprint.structure !== "roof") throw new Error("The blueprint was not placed");
  give(game, "plank", ROOF_PLANK_COST);
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  const built: Entity = blueprint;
  stepUntil(game, () => built.blueprint === undefined);
  return blueprint;
}

export function walkTo(game: Game, to: { x: number; z: number }): void {
  send(game, { type: "walkTo", ...to });
  stepUntil(game, () => game.entities.with("player", "walkPath").first === undefined);
}

/** The standing tree nearest the player. */
export function nearestTree(game: Game) {
  const { position } = onlyPlayer(game);
  const trees = game.entities.with("tree", "position").entities;
  const distance = (tree: (typeof trees)[number]) => Math.hypot(tree.position.x - position.x, tree.position.z - position.z);
  const nearest = [...trees].sort((a, b) => distance(a) - distance(b))[0];
  if (nearest === undefined) throw new Error("No trees");
  return nearest;
}

/** Builds a lean-to near the player. */
export function finishedLeanTo(game: Game): Entity {
  const spot = openLeanToSpot(game);
  send(game, place("leanTo", spot, 0));
  const leanTo = onlyBlueprint(game);
  give(game, "stick", LEAN_TO_STICK_COST);
  give(game, "bark", LEAN_TO_BARK_COST);
  send(game, { type: "build", blueprintId: idOf(game, leanTo) });
  stepUntil(game, () => leanTo.blueprint === undefined);
  return leanTo;
}

/** Packs firewood, then spare knives, into the backpack until its contents weigh as close to `kilograms` as they can without going over. */
export function fillBackpackUntilFree(game: Game, kilograms: number): void {
  const backpack = onlyPlayer(game).backpack;
  while (backpackWeight(backpack) + CONTENT_WEIGHT_KG.firewood <= kilograms + 1e-9) backpack.contents.firewood = (backpack.contents.firewood ?? 0) + 1;
  while (backpackWeight(backpack) + CONTENT_WEIGHT_KG.knife <= kilograms + 1e-9) backpack.contents.knife = (backpack.contents.knife ?? 0) + 1;
}

/** A spot near the player where a lean-to blueprint is allowed facing any way, with room to walk round it. */
export function openLeanToSpot(game: Game): { x: number; z: number } {
  const player = onlyPlayer(game);
  for (let distance = 4; distance < 40; distance += 1) {
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [0, -1],
      [-1, 0],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const) {
      const spot = { x: Math.round(player.position.x + dx * distance), z: Math.round(player.position.z + dz * distance) };
      const turns = [0, 1, 2, 3] as const;
      const roomy = [
        [0, 0],
        [3, 0],
        [-3, 0],
        [0, 3],
        [0, -3],
      ].every(([ax = 0, az = 0]) => turns.every((turn) => game.client.checkPlacement("leanTo", { x: spot.x + ax, z: spot.z + az }, turn).allowed));
      if (roomy) return spot;
    }
  }
  throw new Error("No open spot");
}

export function give(game: Game, content: "stick" | "bark" | "plank", count: number): void {
  const contents = onlyPlayer(game).backpack.contents;
  contents[content] = (contents[content] ?? 0) + count;
}

/** How many debarked logs lie on the ground. */
export function debarkedLogsOnGround(game: Game): number {
  return game.entities.with("debarkedLog").size;
}

/** Puts a debarked log on the player's shoulder and carries it to a blueprint. */
export function deliverLog(game: Game, blueprint: Entity): void {
  game.entities.addComponent(onlyPlayer(game), "carrying", "debarkedLog");
  send(game, { type: "deliverToBlueprint", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => game.client.getView().carrying === null);
}

/** Puts a finished foundation on a square, as if the player had built it. */
export function finishedFoundationAt(game: Game, square: { x: number; z: number }) {
  const position = { x: square.x, y: foundationDeckTop(game.valley.terrain, square), z: square.z };
  return game.entities.add({ foundation: true, facing: { turns: 0 }, position });
}

/** The middle of a building-grid square a few metres from the player, with open ground two squares all round it. */
export function openSquareNearPlayer(game: Game, from = 4): { x: number; z: number } {
  const player = onlyPlayer(game);
  for (let distance = from; distance < 30; distance += 1) {
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [0, -1],
      [-1, 0],
      [1, 1],
      [1, -1],
    ] as const) {
      const square = { x: Math.floor(player.position.x + dx * distance) + 0.5, z: Math.floor(player.position.z + dz * distance) + 0.5 };
      const reach = [-2, -1, 0, 1, 2];
      const open = reach.every((ax) => reach.every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })));
      if (open && game.client.checkPlacement("foundation", square, 0).allowed) return square;
    }
  }
  throw new Error("No open square");
}

export function place(structure: StructureKind, at: { x: number; z: number }, turns: QuarterTurns): Command {
  return { type: "placeBlueprint", structure, turns, x: at.x, z: at.z };
}

export function onlyBlueprint(game: Game): Entity & { position: NonNullable<Entity["position"]> } {
  const blueprint = game.entities.with("blueprint", "position").first;
  if (blueprint === undefined) throw new Error("No blueprint");
  return blueprint;
}

export function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
}

export function stepUntil(game: Game, done: () => boolean, maxSteps = 100_000): void {
  for (let i = 0; i < maxSteps; i += 1) {
    if (done()) return;
    game.step();
  }
  throw new Error("Never happened");
}

export function runSeconds(game: Game, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * STEPS_PER_SECOND); i += 1) game.step();
}

export function onlyPlayer(game: Game) {
  const player = game.entities.with("player", "position", "backpack", "needs").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

export function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
