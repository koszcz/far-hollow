// Stage helpers shared by the building showcases: cabins built from foundations, walls, and roofs, and a log build posed by progress.
import type { Entity, EntityStore } from "../../sim/entities";
import { FOUNDATION_DECK_LIFT_METRES } from "../../sim/foundations";
import { turnOffset, type QuarterTurns } from "../../sim/quarter-turns";
import type { Stage } from "./types";

/**
 * Builds a 3 by 2 square cabin with log walls all round and a door frame in the middle of the front. Every square but the
 * front right one gets a finished roof frame, and with `roofs`, a finished roof on it too. The front row slopes down to the
 * front and the back row to the back, so they meet at a ridge, with a gable end at each side.
 * Returns a placer that puts an entity on the deck of a square, for the showcase to add the front right square's pieces.
 */
export function squareCabin({ place }: Stage, { roofs }: { roofs: boolean }): (x: number, z: number, entity: Entity) => Entity {
  const onDeck = (x: number, z: number, entity: Entity) => {
    const placed = place(x, z, entity);
    if (placed.position !== undefined) placed.position.y += FOUNDATION_DECK_LIFT_METRES;
    return placed;
  };
  const columns = [-1, 0, 1];
  const rows = [-1, 0];
  for (const x of columns) for (const z of rows) onDeck(x, z, { foundation: true });
  for (const x of columns) {
    onDeck(x, -1.5, { edgePiece: "logWall", facing: { turns: 2 } });
    onDeck(x, 0.5, { edgePiece: x === 0 ? "doorFrame" : "logWall", facing: { turns: 0 } });
  }
  for (const z of rows) {
    onDeck(-1.5, z, { edgePiece: "logWall", facing: { turns: 1 } });
    onDeck(1.5, z, { edgePiece: "logWall", facing: { turns: 3 } });
  }
  for (const x of columns) {
    for (const z of rows) {
      if (x === 1 && z === 0) continue;
      const turns = z === 0 ? 0 : 2;
      onDeck(x, z, { roofFrame: true, facing: { turns } });
      if (roofs) onDeck(x, z, { cabinRoof: true, facing: { turns }, roof: { min: { x: x - 0.5, z: z - 0.5 }, max: { x: x + 0.5, z: z + 0.5 } } });
    }
  }
  return onDeck;
}

/**
 * Sets every blueprint in `store` to `progress` of a build that costs `logCost` debarked logs.
 * Two logs wait delivered, and every log whose stage has started is delivered too, as in the game.
 */
export function showLogBuild(store: EntityStore, progress: number, logCost: number): void {
  for (const entity of store.with("blueprint")) {
    entity.blueprint.progress = progress;
    entity.blueprint.delivered.debarkedLog = Math.max(2, Math.ceil(progress * logCost));
  }
}

/** Puts an entity on the deck of a foundation square at this offset from the stage's middle. */
export function onDeckOf({ place }: Stage): (x: number, z: number, entity: Entity) => Entity {
  return (x, z, entity) => {
    const placed = place(x, z, entity);
    if (placed.position !== undefined) placed.position.y += FOUNDATION_DECK_LIFT_METRES;
    return placed;
  };
}

/** Builds foundations on these squares, and log walls on every edge with no foundation beyond it. */
export function cabinWalls(stage: Stage, squares: readonly (readonly [number, number])[]): void {
  const onDeck = onDeckOf(stage);
  const taken = new Set(squares.map(([x, z]) => `${x},${z}`));
  for (const [x, z] of squares) {
    onDeck(x, z, { foundation: true });
    for (const turns of [0, 1, 2, 3] as const) {
      const out = turnOffset({ x: 0, z: 1 }, turns);
      if (taken.has(`${x + out.x},${z + out.z}`)) continue;
      onDeck(x + out.x / 2, z + out.z / 2, { edgePiece: "logWall", facing: { turns } });
    }
  }
}

/**
 * Builds a cabin three squares wide over columns -1 to 1 and three squares deep over rows -10 to -8, behind the other cabins, with a finished frame on
 * every square, and with `roofs`, a finished roof too. The front row slopes down to the front, the back row to the back,
 * and the middle row with the front one, so the middle row becomes ridge sections and the ridge runs along the middle.
 */
export function oddWidthCabin(stage: Stage, { roofs }: { roofs: boolean }): void {
  const squares = [-1, 0, 1].flatMap((x) => [-10, -9, -8].map((z) => [x, z] as const));
  cabinWalls(stage, squares);
  for (const [x, z] of squares) {
    const turns = z === -10 ? 2 : 0;
    if (roofs) roofOver(stage, x, z, turns);
    else onDeckOf(stage)(x, z, { roofFrame: true, facing: { turns } });
  }
}

/** Puts a finished roof frame facing `turns` on a square, and a finished roof on it. */
export function roofOver(stage: Stage, x: number, z: number, turns: QuarterTurns): void {
  const onDeck = onDeckOf(stage);
  onDeck(x, z, { roofFrame: true, facing: { turns } });
  onDeck(x, z, { cabinRoof: true, facing: { turns }, roof: { min: { x: x - 0.5, z: z - 0.5 }, max: { x: x + 0.5, z: z + 0.5 } } });
}

/**
 * The squares of an L-shaped cabin whose left edge is column `left`: a wing along x over four columns and rows -1 and 0,
 * and a wing along z over its two right columns and rows 1 and 2.
 */
export function lSquares(left: number): (readonly [number, number])[] {
  const alongX = [0, 1, 2, 3].flatMap((x) => [[left + x, -1] as const, [left + x, 0] as const]);
  const alongZ = [2, 3].flatMap((x) => [[left + x, 1] as const, [left + x, 2] as const]);
  return [...alongX, ...alongZ];
}
