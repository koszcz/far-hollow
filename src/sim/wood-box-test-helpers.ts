import { type BackpackContent } from "./api";
import { type Command } from "./api-commands";
import { addToBackpack } from "./backpack";
import { edgeMiddle } from "./edge-pieces";
import type { Entity } from "./entities";
import { foundationDeckTop } from "./foundations";
import { createGame, type Game } from "./game";
import type { GroundPoint } from "./ground-point";
import type { QuarterTurns } from "./quarter-turns";
import { structureOf } from "./structures";
import { addFinished, finishReach, onlyPlayer, stepUntil } from "./test-steps";
import { isWalkable } from "./walk-map";

export type Finished = ReturnType<typeof addFinished>;

/** A room of three squares: a fireplace on the first, the player on the second, and an empty wood box on the third. */
export function gameWithWoodBox(): {
  game: Game;
  box: Finished;
  fireplace: Finished;
  squares: [GroundPoint, GroundPoint, GroundPoint];
} {
  const game = createGame({ seed: 42 });
  const [first, second, third] = roomNearPlayer(game, 3);
  if (third === undefined) throw new Error("A short room");
  const fireplace = addFinished(game, "fireplace", first, 0);
  const box = addFinished(game, "woodBox", third, 0);
  standOn(game, second);
  return { game, box, fireplace, squares: [first, second, third] };
}

/** Adds one piece of firewood to the fire, from beside it, and waits for the reach to end. */
export function addFirewood(game: Game, fire: Finished): void {
  game.client.send({ type: "addFuel", campfireId: fire.id, fuel: "firewood" });
  game.step();
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
  finishReach(game);
}

/** Sends a command on the wood box and waits for the player to walk there and finish the reach. */
export function use(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
  stepUntil(game, () => onlyPlayer(game).walkPath === undefined);
  finishReach(game);
  finishReach(game);
}

/** How many more of a content fit in the player's backpack. */
export function countThatFits(game: Game, content: BackpackContent): number {
  const backpack = structuredClone(onlyPlayer(game).backpack);
  let count = 0;
  while (addToBackpack(backpack, content, 1)) count += 1;
  return count;
}

export function give(game: Game, content: BackpackContent, count: number): void {
  const contents = onlyPlayer(game).backpack.contents;
  contents[content] = (contents[content] ?? 0) + count;
}

/**
 * Builds a finished room of `length` foundation squares in a row along +x near the player, with log walls all round and a roof
 * on every square. Returns the squares' middles, in order.
 */
export function roomNearPlayer(game: Game, length: number): [GroundPoint, GroundPoint, ...GroundPoint[]] {
  const start = openSquareNearPlayer(game);
  const squares = Array.from({ length }, (_, i) => ({ x: start.x + i, z: start.z }));
  const deck = (square: GroundPoint) => ({
    x: square.x,
    y: foundationDeckTop(game.valley.terrain, square),
    z: square.z,
  });
  for (const square of squares) game.entities.add({ foundation: true, facing: { turns: 0 }, position: deck(square) });
  squares.forEach((square, i) => {
    const sides: QuarterTurns[] = [0, 2];
    if (i === 0) sides.push(1);
    if (i === length - 1) sides.push(3);
    for (const side of sides) addEdge(game, square, side);
  });
  for (const square of squares)
    game.entities.add({
      ...structureOf("roof").finish(square, 0, game.entities),
      facing: { turns: 0 },
      position: deck(square),
    });
  const [first, second, ...rest] = squares;
  if (first === undefined || second === undefined) throw new Error("A room here needs at least two squares");
  return [first, second, ...rest];
}

/** Adds a finished log wall on one side of a square. */
export function addEdge(game: Game, square: GroundPoint, side: QuarterTurns): void {
  const edge = edgeMiddle(square, side);
  game.entities.add({
    ...structureOf("logWall").finish(edge, side, game.entities),
    facing: { turns: side },
    position: { x: edge.x, y: 0, z: edge.z },
  });
}

export function wallOn(game: Game, square: GroundPoint, side: QuarterTurns): Entity {
  const edge = edgeMiddle(square, side);
  const wall = game.entities
    .with("edgePiece", "position")
    .entities.find(({ position }) => Math.abs(position.x - edge.x) < 1e-6 && Math.abs(position.z - edge.z) < 1e-6);
  if (wall === undefined) throw new Error("No wall there");
  return wall;
}

/** Puts the player straight onto a spot, as if they had walked there. */
export function standOn(game: Game, spot: GroundPoint): void {
  const player = onlyPlayer(game);
  player.position = { x: spot.x, y: foundationDeckTop(game.valley.terrain, spot), z: spot.z };
  player.previousPosition = { ...player.position };
}

/** The middle of a building-grid square a few metres from the player, with open ground three squares all round it. */
export function openSquareNearPlayer(game: Game): GroundPoint {
  const player = onlyPlayer(game);
  for (let distance = 4; distance < 30; distance += 1) {
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [0, -1],
      [-1, 0],
    ] as const) {
      const square = {
        x: Math.floor(player.position.x + dx * distance) + 0.5,
        z: Math.floor(player.position.z + dz * distance) + 0.5,
      };
      const reach = [-3, -2, -1, 0, 1, 2, 3, 4, 5];
      const open = reach.every((ax) => reach.every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })));
      if (open && game.client.checkPlacement("foundation", square, 0).allowed) return square;
    }
  }
  throw new Error("No open square");
}

export function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
