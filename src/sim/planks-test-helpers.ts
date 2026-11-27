// Shared setup for the plank tests.
import type { BackpackContent } from "./api";
import type { Command } from "./api-commands";
import type { Entity } from "./entities";
import { STEPS_PER_SECOND, type Game } from "./game";
import { isWalkable } from "./walk-map";

/** Starts cutting planks at the nearest sawhorse and waits until the work is done. */
export function cutPlanks(game: Game): void {
  send(game, { type: "craft", recipe: "planks" });
  stepUntil(game, () => game.client.getView().action?.kind === "craft");
  stepUntil(game, () => game.client.getView().action === null);
}

/** Every pile of planks lying on the ground. */
export function plankPiles(game: Game) {
  return game.entities.with("pile", "position").entities.filter(({ pile }) => pile.content === "plank");
}

/** Walks the player to a spot 5 m from the sawhorse, on its far side from the log. */
export function walkAwayFrom(game: Game, sawhorse: Entity & { position: NonNullable<Entity["position"]> }): void {
  send(game, { type: "walkTo", x: sawhorse.position.x, z: sawhorse.position.z - 5 });
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
}

/** Lays a debarked log on the ground `metres` from a sawhorse, on its open side. */
export function debarkedLogBeside(game: Game, sawhorse: Entity & { position: NonNullable<Entity["position"]> }, metres: number): Entity {
  const { x, y, z } = sawhorse.position;
  return game.entities.add({ debarkedLog: { heading: 0 }, position: { x, y, z: z + metres } });
}

/** Puts a finished sled holding `contents` with its middle `metres` from a sawhorse, on its open side. Its runners run along x. */
export function sledBeside(
  game: Game,
  sawhorse: Entity & { position: NonNullable<Entity["position"]> },
  metres: number,
  contents: Record<"log" | "debarkedLog" | "plank", number>,
): Entity & { sled: Record<"log" | "debarkedLog" | "plank", number> } {
  const { x, y, z } = sawhorse.position;
  const sled = { ...contents };
  return Object.assign(game.entities.add({ sled, facing: { turns: 0 }, position: { x, y, z: z + metres } }), { sled });
}

/** Places a sawhorse blueprint on open ground a few metres from the player and builds it. */
export function finishedSawhorseNearPlayer(game: Game, from = 5) {
  const square = openSquareNearPlayer(game, from);
  send(game, { type: "placeBlueprint", structure: "sawhorse", turns: 0, x: square.x + 0.5, z: square.z + 0.5 });
  const sawhorse = onlyBlueprint(game);
  buildFully(game, sawhorse);
  return sawhorse;
}

/** Places a sawhorse blueprint on open ground a few metres from the player, and leaves it unbuilt. */
export function sawhorseBlueprintNearPlayer(game: Game, from = 5) {
  const square = openSquareNearPlayer(game, from);
  send(game, { type: "placeBlueprint", structure: "sawhorse", turns: 0, x: square.x + 0.5, z: square.z + 0.5 });
  return onlyBlueprint(game);
}

/** Carries the debarked logs a blueprint needs to it, one at a time, and holds the build action until it is finished. */
export function buildFully(game: Game, blueprint: Entity): void {
  const id = idOf(game, blueprint);
  const needs = game.client.describeBlueprint(id)?.deliveries[0]?.needs ?? 0;
  for (let i = 0; i < needs; i += 1) {
    game.entities.addComponent(onlyPlayer(game), "carrying", "debarkedLog");
    send(game, { type: "deliverToBlueprint", blueprintId: id });
    stepUntil(game, () => game.client.getView().carrying === null);
  }
  send(game, { type: "build", blueprintId: id });
  stepUntil(game, () => blueprint.blueprint === undefined);
}

/** The middle of a building-grid square some metres from the player, with open ground all round it. */
export function openSquareNearPlayer(game: Game, from: number): { x: number; z: number } {
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
      const open = [-3, -2, -1, 0, 1, 2, 3].every((ax) =>
        [-3, -2, -1, 0, 1, 2, 3].every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })),
      );
      if (open) return square;
    }
  }
  throw new Error("No open square");
}

/** Puts more things in the player's backpack, whatever their weight. */
export function give(game: Game, contents: Partial<Record<BackpackContent, number>>): void {
  const backpack = onlyPlayer(game).backpack.contents;
  for (const [content, count] of Object.entries(contents) as [BackpackContent, number][]) backpack[content] = (backpack[content] ?? 0) + count;
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
  const player = game.entities.with("player", "position", "backpack").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

export function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
