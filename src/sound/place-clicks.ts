// Hears when the player places a blueprint or takes a piece down, so the action sounds play the place click.
// It reads game state each frame and never changes it.
import { type Entity, type EntityStore } from "../sim/entities";
import { blueprintEntities, playerEntities } from "../sim/entity-queries";

export interface PlaceClicks {
  /**
   * How many blueprints were placed and pieces taken down since the last call. The first call only takes note of what the
   * game holds, so a loaded game makes no click.
   */
  clicksSinceLastFrame(): number;
}

export function createPlaceClicks(entities: EntityStore): PlaceClicks {
  const blueprints = blueprintEntities(entities);
  const players = playerEntities(entities);
  /** Every blueprint seen last frame, and the piece the player was taking down then. */
  let watched: Set<Entity> | undefined;

  return {
    clicksSinceLastFrame() {
      const now = new Set<Entity>(blueprints);
      const takingDown = players.first?.takeDownTask;
      const piece = takingDown === undefined ? undefined : entities.entity(takingDown.pieceId);
      if (piece !== undefined) now.add(piece);
      const before = watched;
      watched = now;
      if (before === undefined) return 0;
      let clicks = 0;
      // A new blueprint was placed.
      for (const entity of now) if (!before.has(entity) && entity.blueprint !== undefined && entity !== piece) clicks += 1;
      // A blueprint or piece that is gone from the game was taken down. A blueprint built into a finished piece stays.
      for (const entity of before) if (!entities.has(entity)) clicks += 1;
      return clicks;
    },
  };
}
