import { World } from "miniplex";
import type { GroundPoint } from "./valley";

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
  /** Marks a standing tree. Its position is the foot of its trunk. */
  tree?: true;
  /** Marks the player. There is only ever one. */
  player?: true;
  /** The spots the entity still has to walk through, in order. Missing when it stands still. */
  walkPath?: GroundPoint[];
  /**
   * Stops the player walking within `radius` metres of the entity's position.
   * Anything that should block walking, such as a tree, stump, or campfire, gets this component.
   * A blocker must not move while it has this component.
   */
  blocksWalking?: { radius: number };
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

/** Standing trees. */
export function treeEntities(store: EntityStore) {
  return store.with("tree", "position");
}

/** The player. There is only ever one. */
export function playerEntities(store: EntityStore) {
  return store.with("player", "position", "previousPosition");
}

/** Everything that stops the player walking near it. */
export function walkBlockerEntities(store: EntityStore) {
  return store.with("blocksWalking", "position");
}
