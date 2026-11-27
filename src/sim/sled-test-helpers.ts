import type { Command } from "./api-commands";
import type { StructureKind } from "./api";
import type { Entity } from "./entities";
import { STEPS_PER_SECOND, type Game } from "./game";
import { SLED_STICK_COST } from "./structure-freely-placed";
import { isWalkable } from "./walk-map";
import { finishReach } from "./test-steps";

/** Builds a woodpile on the grid point just off one side of a sled. */
export function woodpileBeside(game: Game, sled: Entity & { position: { x: number; z: number } }) {
  send(game, place("woodpile", Math.round(sled.position.x), Math.round(sled.position.z) + 1, 0));
  const blueprint = onlyBlueprint(game);
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => blueprint.blueprint === undefined);
  const woodpile = game.entities.with("woodpile", "position").first;
  if (woodpile === undefined) throw new Error("No woodpile");
  return woodpile;
}

/** Every log and debarked log lying on the ground within a few metres of a sled, in the order they were laid. */
export function logsLyingNear(game: Game, sled: Entity & { position: { x: number; z: number } }): Entity[] {
  return [...game.entities.with("position").entities].filter(
    (entity) =>
      (entity.log !== undefined || entity.debarkedLog !== undefined) &&
      Math.hypot(entity.position.x - sled.position.x, entity.position.z - sled.position.z) < 2.5,
  );
}

/** Builds a finished, empty sled on open ground a few metres from the player. */
export function finishedSledNearPlayer(game: Game) {
  const blueprint = sledBlueprintNearPlayer(game);
  buildFully(game, blueprint);
  return blueprint;
}

/** Builds a finished, empty sled facing along x, in the middle of open ground that reaches at least 9 m from it every way. */
export function finishedSledInOpenGround(game: Game) {
  const player = onlyPlayer(game);
  const clear = (square: { x: number; z: number }) => {
    for (let ax = -9; ax <= 9; ax += 1) {
      for (let az = -9; az <= 9; az += 1) if (!isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })) return false;
    }
    return true;
  };
  for (let distance = 3; distance < 60; distance += 1) {
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [0, -1],
      [-1, 0],
    ] as const) {
      const square = { x: Math.floor(player.position.x + dx * distance) + 0.5, z: Math.floor(player.position.z + dz * distance) + 0.5 };
      if (!clear(square)) continue;
      send(game, place("sled", square.x, square.z, 0));
      const blueprint = onlyBlueprint(game);
      buildFully(game, blueprint);
      const sled = game.entities.with("sled", "position").first;
      if (sled === undefined) throw new Error("No sled");
      return sled;
    }
  }
  throw new Error("No open ground");
}

/** Moves the player straight to a spot, standing still. Returns the spot. */
export function standAt(game: Game, spot: { x: number; z: number }): { x: number; z: number } {
  const player = onlyPlayer(game);
  game.entities.removeComponent(player, "walkPath");
  player.position.x = spot.x;
  player.position.z = spot.z;
  return spot;
}

/** How far the player walks along a path from `from`. */
export function pathLength(from: { x: number; z: number }, path: readonly { x: number; z: number }[]): number {
  let length = 0;
  let at = from;
  for (const spot of path) {
    length += Math.hypot(spot.x - at.x, spot.z - at.z);
    at = spot;
  }
  return length;
}

/** Puts a log or debarked log straight on the player's shoulder. */
export function shoulder(game: Game, log: "log" | "debarkedLog"): void {
  game.entities.addComponent(onlyPlayer(game), "carrying", log);
}

/** Sends a command, then lets the player walk to where they carry it out. */
export function sendAndSettle(game: Game, command: Command): void {
  send(game, command);
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined && onlyPlayer(game).approach === undefined);
  finishReach(game);
}

/** Places a sled blueprint on open ground near the player. */
export function sledBlueprintNearPlayer(game: Game) {
  const square = openSquareNearPlayer(game);
  send(game, place("sled", square.x + 0.1, square.z + 0.2, 0));
  return onlyBlueprint(game);
}

/** Carries the logs a blueprint needs to it, gives the player the sticks, and holds the build action until it is finished. */
export function buildFully(game: Game, blueprint: Entity): void {
  const deliveries = game.client.describeBlueprint(idOf(game, blueprint))?.deliveries ?? [];
  const contents = onlyPlayer(game).backpack.contents;
  for (const { material, needs } of deliveries) {
    if (material === "plank" || material === "stone") contents[material] = (contents[material] ?? 0) + needs;
    else deliverLogs(game, blueprint, needs, material);
  }
  contents.stick = (contents.stick ?? 0) + SLED_STICK_COST;
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => blueprint.blueprint === undefined);
}

/** Carries `count` logs, or debarked logs, to a blueprint, one at a time. */
export function deliverLogs(game: Game, blueprint: Entity, count: number, kind: "log" | "debarkedLog" = "log"): void {
  for (let i = 0; i < count; i += 1) {
    game.entities.addComponent(onlyPlayer(game), "carrying", kind);
    send(game, { type: "deliverToBlueprint", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => game.client.getView().carrying === null);
  }
}

export function nearestTo<T extends Entity & { position: { x: number; z: number } }>(game: Game, candidates: T[]): T {
  const { x, z } = onlyPlayer(game).position;
  const sorted = [...candidates].sort((a, b) => Math.hypot(a.position.x - x, a.position.z - z) - Math.hypot(b.position.x - x, b.position.z - z));
  const nearest = sorted[0];
  if (nearest === undefined) throw new Error("Nothing to pick");
  return nearest;
}

/** The middle of a building-grid square a few metres from the player, with open ground all round it. */
export function openSquareNearPlayer(game: Game, from = 3): { x: number; z: number } {
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
      const open = [-2, -1, 0, 1, 2].every((ax) => [-2, -1, 0, 1, 2].every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })));
      if (open) return square;
    }
  }
  throw new Error("No open square");
}

export function place(structure: StructureKind, x: number, z: number, turns: 0 | 1 | 2 | 3): Command {
  return { type: "placeBlueprint", structure, turns, x, z };
}

export function onlyBlueprint(game: Game): Entity & { position: NonNullable<Entity["position"]> } {
  const blueprint = game.entities.with("blueprint", "position").first;
  if (blueprint === undefined) throw new Error("No blueprint");
  return blueprint;
}

export function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
  finishReach(game);
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
  const player = game.entities.with("player", "position", "backpack").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

export function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
