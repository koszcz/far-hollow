import { describe, expect, it } from "bun:test";
import type { Entity } from "./entities";
import { createGame, type Game } from "./game";
import { USE_REACH_METRES } from "./reach";

describe("the thing nearest the player within reach", () => {
  it("is the one thing in reach", () => {
    const game = gameWithNothingInReach();
    const stick = addNearPlayer(game, { stick: true }, 1);

    expect(game.client.nearestInReach()).toEqual({ kind: "stick", id: idOf(game, stick) });
  });

  it("is the nearer of two things in reach", () => {
    const game = gameWithNothingInReach();
    addNearPlayer(game, { stick: true }, 1.5);
    const bark = addNearPlayer(game, { bark: true }, 0.8);

    expect(game.client.nearestInReach()).toEqual({ kind: "bark", id: idOf(game, bark) });
  });

  it("is nothing when nothing is in reach", () => {
    const game = gameWithNothingInReach();
    addNearPlayer(game, { stick: true }, USE_REACH_METRES + 0.5);

    expect(game.client.nearestInReach()).toBeNull();
  });

  it("names a work station with its kind", () => {
    const game = gameWithNothingInReach();
    const sawhorse = addNearPlayer(game, { workStation: "sawhorse" }, 1);

    expect(game.client.nearestInReach()).toEqual({ kind: "workStation", id: idOf(game, sawhorse), station: "sawhorse" });
  });

  it("skips a bush with nothing on it while it grows back", () => {
    const game = gameWithNothingInReach();
    addNearPlayer(game, { forageSpot: { food: "berries" }, regrowing: { minutesLeft: 60 } }, 0.5);
    const stick = addNearPlayer(game, { stick: true }, 1.5);

    expect(game.client.nearestInReach()).toEqual({ kind: "stick", id: idOf(game, stick) });
  });
});

/** A new game with every thing near the player taken away, so a test can lay out its own. */
function gameWithNothingInReach(): Game {
  const game = createGame({ seed: 42 });
  const player = onlyPlayer(game);
  for (const entity of [...game.entities.with("position")]) {
    if (entity === player || entity.rain !== undefined) continue;
    if (Math.hypot(entity.position.x - player.position.x, entity.position.z - player.position.z) < USE_REACH_METRES + 5) game.entities.remove(entity);
  }
  return game;
}

/** Adds a thing `metres` east of the player. */
function addNearPlayer(game: Game, components: Entity, metres: number): Entity {
  const { x, y, z } = onlyPlayer(game).position;
  return game.entities.add({ ...components, position: { x: x + metres, y, z } });
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
