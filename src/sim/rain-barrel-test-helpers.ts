import { rainEntities, type Entity } from "./entities";
import { type Command } from "./api-commands";
import { type StructureKind } from "./api";
import { STEPS_PER_SECOND, type Game } from "./game";
import { finishReach } from "./test-steps";
import { isWalkable } from "./walk-map";

/**
 * Makes rain fall from now on, without stopping. A small roof over the player keeps them dry, so the cold of the rain
 * does not make them collapse while time is skipped. It stops short of any barrel beside them.
 */
export function letRainFall(game: Game): void {
  const { x, z } = onlyPlayer(game).position;
  if (game.entities.with("roof").size === 0) game.entities.add({ roof: { min: { x: x - 0.5, z: z - 0.5 }, max: { x: x + 0.5, z: z + 0.5 } } });
  const rain = rainEntities(game.entities).first?.rain;
  if (rain === undefined) throw new Error("No weather");
  rain.falling = true;
  rain.changeAtMinutes = game.progress().clockMinutes + 1_000_000;
}

/** Stops rain from now on, without starting again. */
export function stopRain(game: Game): void {
  const rain = rainEntities(game.entities).first?.rain;
  if (rain === undefined) throw new Error("No weather");
  rain.falling = false;
  rain.changeAtMinutes = game.progress().clockMinutes + 1_000_000;
}

/** Drinks from the barrel beside the player, once the reach is done. */
export function drink(game: Game, barrel: Entity): void {
  send(game, { type: "drinkFromRainBarrel", barrelId: idOf(game, barrel) });
  finishReach(game);
}

/** Builds a rain barrel on open ground 2 m from the player, so the player stands within reach of it. */
export function finishedBarrelNearPlayer(game: Game) {
  const square = openSquareNearPlayer(game, 2);
  send(game, place("rainBarrel", square.x, square.z, 0));
  const barrel = blueprintOf(game, "rainBarrel");
  buildFully(game, barrel);
  return barrel;
}

export function walkTo(game: Game, to: { x: number; z: number }): void {
  send(game, { type: "walkTo", x: to.x, z: to.z });
  stepUntil(game, () => game.entities.with("player", "walkPath").first === undefined);
}

/** Gives the player the planks a blueprint still needs and holds the build action until it is finished. */
export function buildFully(game: Game, blueprint: Entity): void {
  const contents = onlyPlayer(game).backpack.contents;
  for (const { material, has, needs } of game.client.describeBlueprint(idOf(game, blueprint))?.deliveries ?? []) {
    if (material === "plank") contents.plank = (contents.plank ?? 0) + needs - has;
  }
  while (blueprint.blueprint !== undefined) {
    send(game, { type: "build", blueprintId: idOf(game, blueprint) });
    stepUntil(game, () => blueprint.blueprint === undefined || game.client.getView().action === null);
  }
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
      const open = [-3, -2, -1, 0, 1, 2, 3].every((ax) =>
        [-3, -2, -1, 0, 1, 2, 3].every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })),
      );
      if (open) return square;
    }
  }
  throw new Error("No open square");
}

export function place(structure: StructureKind, x: number, z: number, turns: 0 | 1 | 2 | 3): Command {
  return { type: "placeBlueprint", structure, turns, x, z };
}

export function blueprintOf(game: Game, structure: StructureKind): Entity & { position: NonNullable<Entity["position"]> } {
  const blueprint = game.entities.with("blueprint", "position").entities.find((entity) => entity.blueprint.structure === structure);
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
  const player = game.entities.with("player", "position", "backpack", "needs", "respawnPoint").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

export function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
