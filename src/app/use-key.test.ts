import { describe, expect, it } from "bun:test";
import type { Entity } from "../sim/entities";
import { createGame, type Game } from "../sim/game";
import { USE_REACH_METRES } from "../sim/reach";
import { useKeyFor } from "./walk-input";

describe("pressing E", () => {
  it("does the main action on the one thing in reach", () => {
    const game = gameWithNothingInReach();
    const stick = addNearPlayer(game, { stick: true }, 1);

    expect(useKeyFor(game.client)?.action.command).toEqual({ type: "pickUpStick", stickId: idOf(game, stick) });
  });

  it("picks up the nearer of two things in reach", () => {
    const game = gameWithNothingInReach();
    const stick = addNearPlayer(game, { stick: true }, 1.5);
    addNearPlayer(game, { bark: true }, 0.8);
    const barkBefore = game.client.getView().backpack.bark ?? 0;

    pressE(game);

    expect(game.client.getView().backpack.bark).toBe(barkBefore + 1);
    expect(game.entities.has(stick)).toBe(true);
  });

  it("does nothing with nothing in reach", () => {
    const game = gameWithNothingInReach();
    addNearPlayer(game, { stick: true }, USE_REACH_METRES + 0.5);

    expect(useKeyFor(game.client)).toBeUndefined();
  });

  it("opens the menu of a work station in reach, as a left-click does", () => {
    const game = gameWithNothingInReach();
    const sawhorse = addNearPlayer(game, { workStation: "sawhorse" }, 1.5);

    expect(useKeyFor(game.client)).toMatchObject({
      thing: { kind: "workStation", id: idOf(game, sawhorse), station: "sawhorse" },
      action: { id: "openMenu", command: undefined },
    });
  });

  it("does nothing when the nearest thing's main action is off", () => {
    const game = gameWithNothingInReach();
    const backpack = onlyPlayer(game).backpack;
    if (backpack !== undefined) delete backpack.contents.axe;
    game.step();
    addNearPlayer(game, { tree: true }, 1);

    expect(useKeyFor(game.client)).toBeUndefined();
  });
});

/** Sends what E does, then lets the player walk there and act. */
function pressE(game: Game): void {
  const command = useKeyFor(game.client)?.action.command;
  if (command === undefined) throw new Error("E does nothing");
  game.client.send(command);
  for (let step = 0; step < 200; step += 1) game.step();
}

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
