import { World } from "miniplex";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Every game object is an entity made of plain data components (ADR 0003). */
export interface Entity {
  /** Where the entity is after the latest logic step, in metres. */
  position?: Vec3;
  /** Where the entity was one logic step earlier. Rendering blends between the two. */
  previousPosition?: Vec3;
}

/** Holds every entity in the game. miniplex calls this a "World". */
export type EntityStore = World<Entity>;

export function createEntityStore(): EntityStore {
  return new World<Entity>();
}

/** Entities that can move, so rendering blends their position between logic steps. */
export function movingEntities(store: EntityStore) {
  return store.with("position", "previousPosition");
}
