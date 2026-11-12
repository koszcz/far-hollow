import { describe, expect, it } from "bun:test";
import type { Command } from "./api";
import type { Entity } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { CAMPFIRE_BUILD_SECONDS, CAMPFIRE_STICK_COST } from "./structures";
import { isWalkable } from "./walk-map";

describe("taking down a finished campfire", () => {
  it("removes it after half its build time and gives back the sticks it cost", () => {
    const game = createGame({ seed: 42 });
    const campfire = buildCampfire(game);
    const sticksBefore = sticksInBackpack(game);

    send(game, { type: "takeDown", pieceId: idOf(game, campfire) });
    runSeconds(game, CAMPFIRE_BUILD_SECONDS * 0.4);
    expect(game.entities.has(campfire)).toBe(true);
    stepUntil(game, () => !game.entities.has(campfire));

    expect(CAMPFIRE_STICK_COST).toBe(5);
    expect(sticksInBackpack(game)).toBe(sticksBefore + 5);
  });

  it("puts out a lit fire, and the fuel still in it is lost", () => {
    const game = createGame({ seed: 42 });
    const campfire = buildCampfire(game);
    campfire.campfire.lit = true;
    campfire.campfire.fuelMinutes = 120;
    const sticksBefore = sticksInBackpack(game);

    send(game, { type: "takeDown", pieceId: idOf(game, campfire) });
    stepUntil(game, () => !game.entities.has(campfire));

    expect(game.entities.with("campfire").size).toBe(0);
    expect(sticksInBackpack(game)).toBe(sticksBefore + CAMPFIRE_STICK_COST);
  });

  it("is refused while a pot is on the fire, and the player is told to empty it first", () => {
    const game = createGame({ seed: 42 });
    const campfire = buildCampfire(game);
    campfire.campfire.lit = true;
    campfire.campfire.fuelMinutes = 120;
    game.entities.addComponent(campfire, "potOnFire", { water: "river", minutesBoiling: 0 });

    send(game, { type: "takeDown", pieceId: idOf(game, campfire) });
    expect(game.client.getView().notice?.kind).toBe("stillHoldsSomething");
    runSeconds(game, CAMPFIRE_BUILD_SECONDS);

    expect(game.entities.has(campfire)).toBe(true);
    expect(campfire.potOnFire).toBeDefined();
  });
});

/** Places a campfire blueprint near the player and builds it, as the player would. */
function buildCampfire(game: Game): Entity & Required<Pick<Entity, "campfire" | "position">> {
  const player = onlyPlayer(game);
  player.backpack.contents.stick = (player.backpack.contents.stick ?? 0) + CAMPFIRE_STICK_COST;
  const spot = openSpotNearPlayer(game);
  send(game, { type: "placeBlueprint", structure: "campfire", turns: 0, x: spot.x, z: spot.z });
  const blueprint = game.entities.with("blueprint", "position").first;
  if (blueprint === undefined) throw new Error("No blueprint");
  send(game, { type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => game.entities.with("campfire").size > 0);
  const campfire = game.entities.with("campfire", "position").first;
  if (campfire === undefined) throw new Error("No campfire");
  return campfire;
}

function sticksInBackpack(game: Game): number {
  return onlyPlayer(game).backpack.contents.stick ?? 0;
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

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
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
  const player = game.entities.with("player", "position", "backpack").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
