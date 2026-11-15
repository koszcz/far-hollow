// Helpers that tests share for running a game's logic steps, finding furniture, and making saves in older forms.
import type { BackpackContents } from "./backpack";
import { furnitureEntities, type Entity, type EntityStore, type Vec3 } from "./entities";
import type { Game } from "./game";
import type { FurnitureKind } from "./structure-kind";
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
