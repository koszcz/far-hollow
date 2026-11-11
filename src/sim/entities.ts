import { World } from "miniplex";
import type { Backpack } from "./backpack";
import type { Needs } from "./needs";
import type { PotOnFire } from "./pot-state";
import type { Sickness } from "./sickness";
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
  /** The tools and small materials the entity carries. Only the player has one. */
  backpack?: Backpack;
  /**
   * The tree the player is walking to or chopping, given by its entity id.
   * `secondsDone` counts only the time spent chopping, not walking.
   */
  chopTask?: { treeId: number; secondsDone: number };
  /** The log on the ground the player is walking to pick up, given by its entity id. */
  logPickUpTask?: { logId: number };
  /** Marks what is left of a felled tree. Its position is the middle of the stump. */
  stump?: true;
  /** Marks a log lying on the ground. Its position is the middle of the log. `heading` is the log's turn about the vertical axis, in radians. */
  log?: { heading: number };
  /** What the entity carries on their shoulder. Only one log fits. */
  carrying?: "log";
  /** Marks a stick lying on the forest floor. Its position is the middle of the stick. */
  stick?: true;
  /** The stick on the ground the player is walking to pick up, given by its entity id. */
  stickPickUpTask?: { stickId: number };
  /** The player is splitting the log on their shoulder into firewood. `secondsDone` counts the time spent so far. */
  splitTask?: { secondsDone: number };
  /**
   * Marks a building piece the player has placed but not finished. Its position is the piece's centre.
   * `progress` runs from 0 to 1. `sticksSpent` counts the sticks construction has used so far.
   */
  blueprint?: { piece: "campfire"; progress: number; sticksSpent: number };
  /** The blueprint the player is walking to or building, given by its entity id. */
  buildTask?: { blueprintId: number };
  /**
   * Marks a finished campfire. Its position is the centre of the fire.
   * `fuelMinutes` is how many more game minutes its fuel can burn. A lit fire goes out when it reaches 0.
   */
  campfire?: { lit: boolean; fuelMinutes: number };
  /** Hunger, thirst, warmth, and fatigue. Only the player has needs. */
  needs?: Needs;
  /** Where the entity wakes after a collapse. Only the player has one. */
  respawnPoint?: GroundPoint;
  /** The player is walking to the riverbank to drink. The spot is where they clicked on the river. */
  drinkTask?: GroundPoint;
  /** The player is sick, so their needs drain faster. Missing when they are well. */
  sickness?: Sickness;
  /** The player is walking to the riverbank to fill the pot. The spot is the middle of the river nearest where they set off. */
  fillPotTask?: GroundPoint;
  /** The full pot sitting on this campfire. Only campfires have one. */
  potOnFire?: PotOnFire;
}

/** Holds every entity in the game. miniplex calls this a "World". */
export type EntityStore = World<Entity>;

export function createEntityStore(): EntityStore {
  return new World<Entity>();
}

/** An entity's components as stored in a save, with the id that tasks and commands know it by. */
export interface SavedEntity {
  id: number;
  components: Entity;
}

/** Lists every entity with its id, in id order. An entity that had no id yet gets one. */
export function saveEntities(store: EntityStore): SavedEntity[] {
  const saved: SavedEntity[] = [];
  for (const entity of store.entities) {
    const id = store.id(entity);
    if (id !== undefined) saved.push({ id, components: entity });
  }
  return saved.sort((a, b) => a.id - b.id);
}

/**
 * Adds saved entities to an empty store, giving each one its saved id.
 * miniplex hands out ids in order, so each unused id goes to a stand-in entity that is removed at once.
 */
export function restoreEntities(store: EntityStore, saved: readonly SavedEntity[]): void {
  const byId = new Map(saved.map((entity) => [entity.id, entity.components]));
  const lastId = saved.reduce((last, entity) => Math.max(last, entity.id), -1);
  for (let id = 0; id <= lastId; id += 1) {
    const components = byId.get(id);
    const entity = store.add(components ?? {});
    if (store.id(entity) !== id) throw new Error("Entities can only be restored into an empty store");
    if (components === undefined) store.remove(entity);
  }
}

/**
 * Gives an entity a component, replacing the one it already has.
 * miniplex's addComponent never overwrites, so a new task would otherwise be ignored while an old one is running.
 */
export function setComponent<K extends keyof Entity>(store: EntityStore, entity: Entity, key: K, value: NonNullable<Entity[K]>): void {
  if (entity[key] === undefined) store.addComponent(entity, key, value);
  else entity[key] = value;
}

/** Entities that can move, so rendering blends their position between logic steps. */
export function movingEntities(store: EntityStore) {
  return store.with("position", "previousPosition");
}

/** Standing trees. */
export function treeEntities(store: EntityStore) {
  return store.with("tree", "position");
}

/** Stumps left by felled trees. */
export function stumpEntities(store: EntityStore) {
  return store.with("stump", "position");
}

/** Logs lying on the ground. Logs on a shoulder are not entities. */
export function logEntities(store: EntityStore) {
  return store.with("log", "position");
}

/** Sticks lying on the forest floor. Sticks in the backpack are not entities. */
export function stickEntities(store: EntityStore) {
  return store.with("stick", "position");
}

/** Building pieces placed but not finished. */
export function blueprintEntities(store: EntityStore) {
  return store.with("blueprint", "position");
}

/** Finished campfires. */
export function campfireEntities(store: EntityStore) {
  return store.with("campfire", "position");
}

/** The player. There is only ever one. */
export function playerEntities(store: EntityStore) {
  return store.with("player", "position", "previousPosition");
}

/** Everything that stops the player walking near it. */
export function walkBlockerEntities(store: EntityStore) {
  return store.with("blocksWalking", "position");
}
