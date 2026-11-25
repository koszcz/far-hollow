// Helpers that tests share for running a game's logic steps, finding furniture, and making saves in older forms.
import type { BackpackContents } from "./backpack";
import { furnitureEntities, type Entity, type EntityStore, type Vec3 } from "./entities";
import type { Game } from "./game";
import type { FurnitureKind, StructureKind } from "./structure-kind";
import { foundationDeckTop } from "./foundations";
import type { GroundPoint } from "./ground-point";
import type { QuarterTurns } from "./quarter-turns";
import { structureOf } from "./structures";
import { isWalkable } from "./walk-map";
import { REACH_SECONDS } from "./hand-reach";
import { STEPS_PER_SECOND } from "./game";

/**
 * Runs logic steps until the player's reach is over, so whatever the reach hands over has changed hands.
 * It gives up after one whole reach's worth of steps, as while the game is paused.
 */
export function finishReach(game: Game): void {
  const maxSteps = Math.ceil(REACH_SECONDS * STEPS_PER_SECOND) + 1;
  for (let steps = 0; steps < maxSteps && game.client.getView().reach !== null; steps += 1) game.step();
}

/** A finished piece of furniture. */
export type Piece = Entity & { position: Vec3; furniture: FurnitureKind };
/** A finished piece of furniture that stores things, with what it holds. */
export type StoringPiece = Piece & { storage: { contents: BackpackContents } };

/** The finished pieces of furniture of one kind. */
export function piecesOf(entities: EntityStore, kind: FurnitureKind): Piece[] {
  return furnitureEntities(entities).entities.filter((entity) => entity.furniture === kind);
}

/** The finished pieces of one kind of furniture that stores things. */
export function storingPiecesOf(entities: EntityStore, kind: FurnitureKind): StoringPiece[] {
  return piecesOf(entities, kind).filter((entity): entity is StoringPiece => entity.storage !== undefined);
}

/** The parts that marked each piece of furniture in saves from before one `furniture` part marked them all. */
export interface OldFurnitureParts {
  chest?: { contents: BackpackContents };
  shelf?: { contents: BackpackContents };
  bed?: true;
  table?: true;
  stool?: true;
}

/**
 * Gives every finished piece of furniture in a save the parts it had before one `furniture` part marked them all,
 * so a test can turn the save back to an older version.
 */
export function withOldFurnitureParts<Save extends { entities: { components: object }[] }>(save: Save): Save {
  for (const saved of save.entities as { components: Entity & OldFurnitureParts }[]) {
    const { furniture, storage, ...others } = saved.components;
    if (furniture === undefined) continue;
    saved.components = { ...others, ...(furniture === "chest" || furniture === "shelf" ? { [furniture]: storage } : { [furniture]: true }) };
  }
  return save;
}

/** Runs logic steps until `done` holds. It throws if that never happens. */
export function stepUntil(game: Game, done: () => boolean, maxSteps = 100_000): void {
  for (let i = 0; i < maxSteps; i += 1) {
    if (done()) return;
    game.step();
  }
  throw new Error("Never happened");
}

/** The only player, with their backpack. */
export function onlyPlayer(game: Game): Entity & { position: Vec3; backpack: { contents: BackpackContents } } {
  const player = game.entities.with("player", "position", "backpack").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

/** The newest blueprint of a structure. It throws if there is none. */
export function newestBlueprint(game: Game, structure: StructureKind): Entity & { position: Vec3 } {
  const blueprint = game.entities
    .with("blueprint", "position")
    .entities.filter((entity) => entity.blueprint.structure === structure)
    .at(-1);
  if (blueprint === undefined) throw new Error(`No ${structure} blueprint`);
  return blueprint;
}

/**
 * Adds a finished foundation on a building-grid square a few metres from the player, with open ground all round it,
 * and returns the square's middle.
 */
export function openFoundation(game: Game, from = 4): GroundPoint {
  const player = onlyPlayer(game);
  for (let distance = from; distance < 30; distance += 1) {
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [0, -1],
      [-1, 0],
    ] as const) {
      const square = { x: Math.floor(player.position.x + dx * distance) + 0.5, z: Math.floor(player.position.z + dz * distance) + 0.5 };
      const reach = [-3, -2, -1, 0, 1, 2, 3];
      const open = reach.every((ax) => reach.every((az) => isWalkable(game.walkMap, { x: square.x + ax, z: square.z + az })));
      if (!open || !game.client.checkPlacement("foundation", square, 0).allowed) continue;
      const position = { x: square.x, y: foundationDeckTop(game.valley.terrain, square), z: square.z };
      game.entities.add({ foundation: true, facing: { turns: 0 }, position });
      return square;
    }
  }
  throw new Error("No open square near the player");
}

/** A finished building piece, with its entity id. */
export interface FinishedPiece {
  readonly id: number;
  readonly entity: Entity & { position: Vec3 };
  readonly position: Vec3;
}

/**
 * Places a blueprint of `structure` near `at` facing `turns`, and finishes it at once, as construction would.
 * It throws if the game refuses the spot.
 */
export function addFinished(game: Game, structure: StructureKind, at: GroundPoint, turns: QuarterTurns): FinishedPiece {
  if (!game.client.checkPlacement(structure, at, turns).allowed) throw new Error(`Cannot place a ${structure} there`);
  game.client.send({ type: "placeBlueprint", structure, turns, x: at.x, z: at.z });
  game.step();
  const entity = newestBlueprint(game, structure);
  game.entities.removeComponent(entity, "blueprint");
  const finished = structureOf(structure).finish({ x: entity.position.x, z: entity.position.z }, entity.facing?.turns ?? 0, game.entities);
  for (const key of Object.keys(finished) as (keyof Entity)[]) game.entities.addComponent(entity, key, finished[key]);
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("No id");
  return { id, entity, position: entity.position };
}
