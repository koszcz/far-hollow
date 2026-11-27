import type { Command } from "./api-commands";
import { edgeMiddle } from "./edge-pieces";
import type { Entity } from "./entities";
import { foundationDeckTop } from "./foundations";
import { STEPS_PER_SECOND, type Game } from "./game";
import type { GroundPoint } from "./ground-point";
import type { QuarterTurns } from "./quarter-turns";
import { LOG_WALL_LOG_COST, WINDOW_LOG_COST } from "./structure-cabin-shell";
import { SHUTTERS_PLANK_COST } from "./structure-cabin-fittings";
import { structureOf } from "./structures";
import { type EdgePieceKind, type StructureKind } from "./structure-kind";
import { isWalkable } from "./walk-map";
/** A finished window on the +z edge of a finished foundation near the player. */
export function finishedWindow(game: Game): Entity & { position: NonNullable<Entity["position"]> } {
  const square = openSquareNearPlayer(game);
  finishedFoundationAt(game, square);
  return finishedPieceAt(game, "window", square, 0);
}

/** Finished, closed shutters in a finished window near the player. */
export function finishedShutters(game: Game): Entity & { position: NonNullable<Entity["position"]>; shutters: { open: boolean } } {
  const window = finishedWindow(game);
  send(game, place("shutters", window.position, 0));
  const blueprint = lastBlueprint(game, "shutters");
  finishShutters(game, blueprint);
  const shutters = blueprint;
  if (shutters.shutters === undefined) throw new Error("The shutters were not finished");
  return shutters as Entity & { position: NonNullable<Entity["position"]>; shutters: { open: boolean } };
}

/** Gives the player the shutters' planks and builds a shutters blueprint to the end. */
export function finishShutters(game: Game, blueprint: Entity): void {
  const contents = onlyPlayer(game).backpack.contents;
  contents.plank = (contents.plank ?? 0) + SHUTTERS_PLANK_COST;
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => blueprint.blueprint === undefined);
}

/** Puts a lit campfire, fireplace, or planted torch on `square`, or stands the player there holding a lit torch. */
export function lightIn(game: Game, light: "campfire" | "fireplace" | "plantedTorch" | "handTorch", square: GroundPoint): void {
  const position = { x: square.x, y: deckTop(game, square), z: square.z };
  if (light === "campfire") game.entities.add({ campfire: { lit: true, fuelMinutes: 60 }, onFoundation: square, position });
  if (light === "fireplace") game.entities.add({ fireplace: { lit: true, fuelMinutes: 60 }, position });
  if (light === "plantedTorch") game.entities.add({ plantedTorch: { minutesLeft: 60 }, position: { ...position, x: square.x + 0.2 } });
  if (light === "handTorch") {
    const player = onlyPlayer(game);
    Object.assign(player.position, position);
    game.entities.addComponent(player, "litTorch", { minutesLeft: 60 });
  }
}

/** The one finished window. */
export function windowOf(game: Game): Entity & { position: NonNullable<Entity["position"]> } {
  const window = game.entities.with("edgePiece", "position").entities.find(({ edgePiece }) => edgePiece === "window");
  if (window === undefined) throw new Error("No window");
  return window;
}

/**
 * Builds a finished room of two foundation squares in a row along +x near the player, with a floor on each square,
 * log walls all round except a window on the first square's outer end, a roof frame and roof on every square, and no door frame.
 * Returns the squares' middles.
 */
export function cabinNearPlayer(game: Game): [GroundPoint, GroundPoint] {
  const start = openSquareNearPlayer(game);
  const squares: [GroundPoint, GroundPoint] = [start, { x: start.x + 1, z: start.z }];
  for (const square of squares) finishedFoundationAt(game, square);
  const [first, second] = squares;
  for (const side of [0, 2] as const) {
    finishedEdge(game, "logWall", first, side);
    finishedEdge(game, "logWall", second, side);
  }
  finishedEdge(game, "window", first, 1);
  finishedEdge(game, "logWall", second, 3);
  for (const square of squares) {
    for (const kind of ["roofFrame", "roof"] as const) {
      game.entities.add({
        ...structureOf(kind).finish(square, 0, game.entities),
        facing: { turns: 0 },
        position: { x: square.x, y: deckTop(game, square), z: square.z },
      });
    }
    game.entities.add({ floor: true, position: { x: square.x, y: deckTop(game, square), z: square.z } });
  }
  return squares;
}

export function finishedEdge(game: Game, kind: EdgePieceKind, square: GroundPoint, side: QuarterTurns): Entity {
  const edge = edgeMiddle(square, side);
  return game.entities.add({
    ...structureOf(kind).finish(edge, side, game.entities),
    facing: { turns: side },
    position: { x: edge.x, y: deckTop(game, square), z: edge.z },
  });
}

export function deckTop(game: Game, square: GroundPoint): number {
  return foundationDeckTop(game.valley.terrain, square);
}

/** Places a wall, door frame, or window blueprint and builds it through to the end, delivering every debarked log it needs. */
export function finishedPieceAt(
  game: Game,
  structure: EdgePieceKind,
  square: GroundPoint,
  turns: QuarterTurns,
): Entity & { position: NonNullable<Entity["position"]> } {
  send(game, place(structure, square, turns));
  const blueprint = lastBlueprint(game, structure);
  const logs = structure === "logWall" ? LOG_WALL_LOG_COST : WINDOW_LOG_COST;
  for (let i = 0; i < logs; i += 1) {
    game.entities.addComponent(onlyPlayer(game), "carrying", "debarkedLog");
    send(game, { type: "deliverToBlueprint", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => game.client.getView().carrying === null);
  }
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  const built: Entity = blueprint;
  stepUntil(game, () => built.blueprint === undefined);
  return blueprint;
}

/** Puts a finished foundation on a square, as if the player had built it. */
export function finishedFoundationAt(game: Game, square: GroundPoint) {
  const position = { x: square.x, y: foundationDeckTop(game.valley.terrain, square), z: square.z };
  return game.entities.add({ foundation: true, facing: { turns: 0 }, position });
}

/** The middle of a building-grid square a few metres from the player, with open ground three squares all round it. */
export function openSquareNearPlayer(game: Game, from = 4): GroundPoint {
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
      const reach = [-3, -2, -1, 0, 1, 2, 3, 4];
      const open = reach.every((ax) => reach.every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })));
      if (open && game.client.checkPlacement("foundation", square, 0).allowed) return square;
    }
  }
  throw new Error("No open square");
}

export function place(structure: StructureKind, at: GroundPoint, turns: QuarterTurns): Command {
  return { type: "placeBlueprint", structure, turns, x: at.x, z: at.z };
}

export function lastBlueprint(game: Game, structure: StructureKind): Entity & { position: NonNullable<Entity["position"]> } {
  const blueprint = game.entities
    .with("blueprint", "position")
    .entities.filter((entity) => entity.blueprint.structure === structure)
    .at(-1);
  if (blueprint === undefined) throw new Error(`No ${structure} blueprint`);
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
