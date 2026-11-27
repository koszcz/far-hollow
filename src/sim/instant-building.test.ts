import { describe, expect, it } from "bun:test";
import type { Command } from "./api-commands";
import { blueprintEntities } from "./entity-queries";
import { createGame, type Game } from "./game";
import { type QuarterTurns } from "./quarter-turns";
import type { StructureKind } from "./structure-kind";
import { isWalkable } from "./walk-map";
import { onlyPlayer } from "./test-steps";

describe("instant building", () => {
  it("finishes each blueprint the moment it is placed, so a one-square cabin goes up in a few clicks", () => {
    const game = createGame({ seed: 42, instantBuilding: true });
    const square = openSquareNearPlayer(game);

    send(game, place("foundation", square, 0, true));
    expect(game.entities.with("foundation").entities).toHaveLength(1);
    for (const turns of [0, 1, 2, 3] as const) send(game, place("logWall", square, turns, true));
    expect(game.entities.with("edgePiece").entities).toHaveLength(4);
    send(game, place("roofFrame", square, 0, true));
    const frame = game.entities.with("roofFrame").first;
    const frameId = frame === undefined ? undefined : game.entities.id(frame);
    if (frameId === undefined) throw new Error("No roof frame");

    send(game, { type: "buildAddOn", hostId: frameId });

    expect(game.entities.with("roof").entities).toHaveLength(1);
    expect(blueprintEntities(game.entities).entities).toHaveLength(0);
    expect(onlyPlayer(game).buildTask).toBeUndefined();
  });

  it("spends nothing from the backpack", () => {
    const game = createGame({ seed: 42, instantBuilding: true });
    const before = structuredClone(onlyPlayer(game).backpack.contents);

    send(game, place("foundation", openSquareNearPlayer(game), 0, true));

    expect(onlyPlayer(game).backpack.contents).toEqual(before);
  });

  it("places every piece on the building grid in rows, but not furniture", () => {
    const menu = createGame({ seed: 42, instantBuilding: true }).client.getView().buildMenu;
    const inRows = (structure: StructureKind) => menu.find((entry) => entry.structure === structure)?.inRows;

    expect(inRows("foundation")).toBe(true);
    expect(inRows("logWall")).toBe(true);
    expect(inRows("roofFrame")).toBe(true);
    expect(inRows("chest")).toBeUndefined();
  });

  it("is off in an ordinary game, where only a floor is placed in rows", () => {
    const menu = createGame({ seed: 42 }).client.getView().buildMenu;

    expect(menu.filter((entry) => entry.inRows === true).map(({ structure }) => structure)).toEqual(["floor"]);
  });
});

function place(structure: StructureKind, at: { x: number; z: number }, turns: QuarterTurns, thenBuild = false): Command {
  return { type: "placeBlueprint", structure, turns, x: at.x, z: at.z, thenBuild };
}

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
}

/** A building-grid square a few metres from the player, with open ground all round it. */
function openSquareNearPlayer(game: Game): { x: number; z: number } {
  const player = onlyPlayer(game);
  for (let distance = 4; distance < 30; distance += 1) {
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [0, -1],
      [-1, 0],
    ] as const) {
      const square = { x: Math.floor(player.position.x + dx * distance) + 0.5, z: Math.floor(player.position.z + dz * distance) + 0.5 };
      const reach = [-2, -1, 0, 1, 2];
      const open = reach.every((ax) => reach.every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })));
      if (open && game.client.checkPlacement("foundation", square, 0).allowed) return square;
    }
  }
  throw new Error("No open square near the player");
}
