import { describe, expect, it } from "bun:test";
import type { Entity } from "../sim/entities";
import { createGame, type Game } from "../sim/game";
import { createPlaceClicks } from "./place-clicks";

describe("place clicks", () => {
  it("hears nothing from what the game already holds when sound begins", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    placeCampfireNearPlayer(game);
    expect(createPlaceClicks(game.entities).clicksSinceLastFrame()).toBe(0);
  });

  it("clicks once when a blueprint is placed", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const clicks = createPlaceClicks(game.entities);
    clicks.clicksSinceLastFrame();
    placeCampfireNearPlayer(game);
    expect(clicks.clicksSinceLastFrame()).toBe(1);
    expect(clicks.clicksSinceLastFrame()).toBe(0);
  });

  it("does not click when a blueprint is built into a finished piece", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const blueprint = placeCampfireNearPlayer(game);
    const clicks = createPlaceClicks(game.entities);
    clicks.clicksSinceLastFrame();
    buildUntilFinished(game, blueprint);
    expect(clicks.clicksSinceLastFrame()).toBe(0);
  });

  it("clicks once when the player takes a blueprint down", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const blueprint = placeCampfireNearPlayer(game);
    const clicks = createPlaceClicks(game.entities);
    clicks.clicksSinceLastFrame();
    takeDown(game, blueprint);
    expect(clicks.clicksSinceLastFrame()).toBe(1);
  });

  it("clicks once when the player takes a finished piece down, and not before it comes down", () => {
    const game = createGame({ seed: 42, freeBuilding: true });
    const piece = placeCampfireNearPlayer(game);
    buildUntilFinished(game, piece);
    const clicks = createPlaceClicks(game.entities);
    clicks.clicksSinceLastFrame();
    game.client.send({ type: "takeDown", pieceId: idOf(game, piece) });
    game.step();
    expect(clicks.clicksSinceLastFrame()).toBe(0);
    stepUntil(game, () => !game.entities.has(piece));
    expect(clicks.clicksSinceLastFrame()).toBe(1);
  });
});

/** Places a campfire blueprint on the first open spot near the player, and returns it. */
function placeCampfireNearPlayer(game: Game): Entity {
  const player = game.entities.with("player", "position").first;
  if (player === undefined) throw new Error("No player");
  for (let distance = 3; distance < 30; distance += 1) {
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ] as const) {
      game.client.send({ type: "placeBlueprint", structure: "campfire", turns: 0, x: player.position.x + dx * distance, z: player.position.z + dz * distance });
      game.step();
      const placed = game.entities.with("blueprint", "position").first;
      if (placed !== undefined) return placed;
    }
  }
  throw new Error("No open spot");
}

function buildUntilFinished(game: Game, blueprint: Entity): void {
  game.client.send({ type: "build", blueprintId: idOf(game, blueprint) });
  stepUntil(game, () => blueprint.blueprint === undefined);
}

function takeDown(game: Game, piece: Entity): void {
  game.client.send({ type: "takeDown", pieceId: idOf(game, piece) });
  stepUntil(game, () => !game.entities.has(piece));
}

function stepUntil(game: Game, done: () => boolean, maxSteps = 100_000): void {
  for (let step = 0; step < maxSteps; step += 1) {
    if (done()) return;
    game.step();
  }
  throw new Error("Never happened");
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
