import { World } from "miniplex";
import type { CampfireFuel, CarriedLog, WoodpileWood } from "./wood-and-fuel";
import type { Backpack, BackpackContent, BackpackContents, Food } from "./backpack";
import type { RecipeKind } from "./recipe-kind";
import type { Needs } from "./needs";
import type { PotOnFire } from "./pot-state";
import type { Rain } from "./rain";
import type { StickFallState } from "./stick-fall";
import type { Sickness } from "./sickness";
import type { DeliveredMaterial, EdgePieceKind, GroundRect, QuarterTurns, StructureKind, WorkStationKind } from "./structure-kind";
import type { GroundPoint } from "./valley";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type { CampfireFuel, CarriedLog, WoodpileWood } from "./wood-and-fuel";

/**
 * Work on a campfire, woodpile, or sled that needs the player within its reach. Out of reach, the player walks there first.
 * Each kind has the shape of the command in api.ts that asks for it, so the command can be stored as it is.
 */
export type TendTask =
  | { type: "addFuel"; campfireId: number; fuel: CampfireFuel }
  | { type: "lightCampfire" | "putPotOnFire" | "takePotOffFire"; campfireId: number }
  | { type: "stackOnWoodpile"; woodpileId: number; wood: WoodpileWood; all: boolean }
  | { type: "takeFromWoodpile"; woodpileId: number; wood: WoodpileWood }
  | { type: "loadSled" | "tipOutSled" | "dragSled"; sledId: number }
  | { type: "takeFromSled"; sledId: number; log: CarriedLog };

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
  /**
   * Stops the player walking on the walk-map squares that hold these spots, given in metres.
   * Structures with straight sides, such as a lean-to's frame, block walking with this instead of `blocksWalking`.
   * A blocker must not change its spots while it has this component.
   */
  blocksWalkingSpots?: GroundPoint[];
  /**
   * Stops the player stepping across the edge between two walk-map squares side by side, each given by a spot on it, in metres.
   * The player can still stand on either square. A log wall blocks walking with this.
   * A blocker must not change its edges while it has this component.
   */
  blocksWalkingEdges?: { from: GroundPoint; to: GroundPoint }[];
  /** The tools and small materials the entity carries. Only the player has one. */
  backpack?: Backpack;
  /**
   * The tree the player is walking to or chopping, given by its entity id.
   * `secondsDone` counts only the time spent chopping, not walking.
   */
  chopTask?: { treeId: number; secondsDone: number };
  /** The log or debarked log on the ground the player is walking to pick up, given by its entity id. */
  logPickUpTask?: { logId: number };
  /** The spot on the ground the player is walking to, to lay the log on their shoulder there. */
  logDropTask?: { x: number; z: number };
  /** Marks what is left of a felled tree. Its position is the middle of the stump. */
  stump?: true;
  /** Marks a log lying on the ground. Its position is the middle of the log. `heading` is the log's turn about the vertical axis, in radians. */
  log?: { heading: number };
  /** Marks a log with its bark stripped off, lying on the ground. Its position is the middle of the log. `heading` is as for `log`. */
  debarkedLog?: { heading: number };
  /** The log on the ground the player is walking to or debarking, given by its entity id. `secondsDone` counts only the time spent debarking. */
  debarkTask?: { logId: number; secondsDone: number };
  /** What the entity carries on their shoulder: a log or a debarked log. Only one fits. */
  carrying?: CarriedLog;
  /** The sled the player drags behind them, given by its entity id. Their hands are busy until they let go. Only the player has one. */
  dragging?: { sledId: number };
  /** Marks a stick lying on the forest floor. Its position is the middle of the stick. */
  stick?: true;
  /** The stick on the ground the player is walking to pick up, given by its entity id. */
  stickPickUpTask?: { stickId: number };
  /** Marks a piece of bark lying on the ground. Its position is the middle of the bark. Bark in the backpack is not an entity. */
  bark?: true;
  /** The piece of bark on the ground the player is walking to pick up, given by its entity id. */
  barkPickUpTask?: { barkId: number };
  /** The player is splitting the log on their shoulder into firewood. `secondsDone` counts the time spent so far. */
  splitTask?: { secondsDone: number };
  /**
   * The player is crafting `recipe`. `secondsDone` counts the time spent so far.
   * For a station recipe, `stationId` is the work station the player walks to and works at. A hand recipe has none.
   * It is never saved, so a loaded game is not crafting.
   */
  craftTask?: { recipe: RecipeKind; secondsDone: number; stationId?: number };
  /**
   * Marks a structure the player has placed but not finished. Its position is the structure's centre.
   * `progress` runs from 0 to 1. `materialsSpent` counts the materials construction has used so far, one for each stage begun.
   * `delivered` counts the materials the player has carried to it, such as debarked logs, including any already spent.
   */
  blueprint?: { structure: StructureKind; progress: number; materialsSpent: number; delivered: Partial<Record<DeliveredMaterial, number>> };
  /** Which way a blueprint, or the structure built from it, faces. */
  facing?: { turns: QuarterTurns };
  /** The blueprint the player is walking to or building, given by its entity id. */
  buildTask?: { blueprintId: number };
  /**
   * The blueprint or finished structure the player is walking to or taking down, given by its entity id.
   * `secondsDone` counts only the time spent taking it down, not walking.
   */
  takeDownTask?: { pieceId: number; secondsDone: number };
  /** The blueprint the player is walking to, to add the material on their shoulder to it, given by its entity id. */
  deliverTask?: { blueprintId: number };
  /**
   * Marks a finished foundation: a deck of logs covering one building-grid square, on legs down to the ground.
   * Its position is the middle of the top of the deck. The player can walk onto it and across it.
   */
  foundation?: true;
  /**
   * Marks a finished log wall or door frame. It stands on the edge of a foundation square, along the line between two squares.
   * Its position is the middle of that edge, at the height of the foundation's deck. Its `facing` says which edge of the square it is.
   */
  edgePiece?: EdgePieceKind;
  /**
   * Marks a finished roof frame: the timber skeleton of one foundation square, level beams on the wall tops and sloped rafters on them.
   * It rests on the log walls and door frames on its square's edges. A cabin roof section is laid on it.
   * Its position is the middle of that square, at the height of the foundation's deck. Its `facing` says which way it slopes down.
   * It is no roof overhead: only the roof laid on it keeps the rain off.
   */
  roofFrame?: true;
  /**
   * Marks a finished cabin roof section: bark laid on the finished roof frame of one foundation square.
   * Its position is the middle of that square, at the height of the foundation's deck. Its `roof` is that square.
   * Its `facing` is the frame's, and says which way it slopes down. A section facing the default way slopes down to +z.
   */
  cabinRoof?: true;
  /**
   * Marks a finished campfire. Its position is the centre of the fire.
   * `fuelMinutes` is how many more game minutes its fuel can burn. A lit fire goes out when it reaches 0.
   */
  campfire?: { lit: boolean; fuelMinutes: number };
  /**
   * Marks a campfire built on a foundation, with the middle of that foundation's grid square.
   * A lit campfire on a foundation in a room warms the whole room. Missing for a campfire on the ground.
   */
  onFoundation?: GroundPoint;
  /**
   * Marks a finished woodpile, with how many of each kind of wood are stacked on it. Its position is the middle of the pile.
   * It holds up to WOODPILE_CAPACITY pieces in all, in any mix.
   */
  woodpile?: Record<WoodpileWood, number>;
  /**
   * Marks a finished chest: furniture that holds small materials, tools, and food, grouped by kind like the backpack.
   * `contents` says how many of each kind it holds, up to CHEST_WEIGHT_LIMIT_KG in all. Logs never go in a chest.
   * Its position is the middle of its base, on the ground or on a foundation's deck. Its `facing` says which way its front faces.
   */
  chest?: { contents: BackpackContents };
  /**
   * Marks a finished sled, with how many logs and debarked logs lie on it. Its position is the middle of the ground it covers.
   * Its `facing` says which way it is turned. A sled blocks no walking, since the player drags it about.
   */
  sled?: Record<CarriedLog, number>;
  /**
   * The way a sled points once the player has dragged it, in radians about the vertical axis, as `facingRadians` gives for `facing`.
   * Its runners run along this turn. Drawing uses it in place of `facing`, which keeps the nearest quarter turn.
   */
  dragHeading?: number;
  /**
   * Marks a finished work station, such as a sawhorse, with its kind. A blueprint of a work station does not have it.
   * Its position is the middle of the ground it covers. Its `facing` says which way it is turned.
   */
  workStation?: WorkStationKind;
  /** Marks a finished lean-to. Its position is the middle of the ground it covers. */
  leanTo?: true;
  /** The ground a roof covers. A player standing there is under a roof, so rain does not fall on them. */
  roof?: GroundRect;
  /** Marks a berry bush or a patch of mushrooms the player can forage. Its position is the middle of the plant. */
  forageSpot?: { food: Food };
  /** A foraged bush or mushroom patch growing back. It has food again when `minutesLeft` game minutes have passed. */
  regrowing?: { minutesLeft: number };
  /** The bush or mushroom patch the player is walking to forage, given by its entity id. */
  forageTask?: { spotId: number };
  /** Marks a bedroll laid out on the ground. Its position is the middle of the bedroll. A rolled-up bedroll is in the backpack. */
  bedroll?: true;
  /** The laid bedroll the player is walking to, given by its entity id, and what they do there: pick it up or sleep on it. */
  bedrollTask?: { bedrollId: number; then: "pickUp" | "sleep" };
  /** The campfire or woodpile command the player is walking to carry out. They carry it out once they stop beside it. */
  tendTask?: TendTask;
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
  /** Whether rain is falling in the valley, and until when. Only one entity, the valley's weather, has it. */
  rain?: Rain;
  /** When the next sticks fall from the trees. Only one entity, the valley's stick fall, has it. */
  stickFall?: StickFallState;
  /**
   * Marks a pile: things of one kind the player dropped from the backpack, lying on the ground. Its position is the middle of the pile.
   * `count` is how many it holds, always at least 1. A pile with nothing left is removed.
   */
  pile?: { content: BackpackContent; count: number };
  /** The pile the player is walking to pick up, given by its entity id. */
  pileTask?: { pileId: number };
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

/**
 * Lists every entity with its id, in id order. An entity that had no id yet gets one.
 * Crafting in progress is left out, because it is never saved.
 */
export function saveEntities(store: EntityStore): SavedEntity[] {
  const saved: SavedEntity[] = [];
  for (const entity of store.entities) {
    const id = store.id(entity);
    if (id === undefined) continue;
    if (entity.craftTask === undefined) {
      saved.push({ id, components: entity });
      continue;
    }
    const components = { ...entity };
    delete components.craftTask;
    saved.push({ id, components });
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

/** The entity with this id, if it exists and has every one of `components`. */
export function entityWith<K extends keyof Entity>(store: EntityStore, id: number, ...components: K[]): (Entity & Required<Pick<Entity, K>>) | undefined {
  const entity = store.entity(id);
  if (entity === undefined || components.some((component) => entity[component] === undefined)) return undefined;
  return entity as Entity & Required<Pick<Entity, K>>;
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

/** Debarked logs lying on the ground. Debarked logs on a shoulder are not entities. */
export function debarkedLogEntities(store: EntityStore) {
  return store.with("debarkedLog", "position");
}

/** Sticks lying on the forest floor. Sticks in the backpack are not entities. */
export function stickEntities(store: EntityStore) {
  return store.with("stick", "position");
}

/** Pieces of bark lying on the ground. Bark in the backpack is not an entity. */
export function barkEntities(store: EntityStore) {
  return store.with("bark", "position");
}

/** Everything lying loose on the ground that the player can pick up: logs, debarked logs, sticks, bark, bedrolls, and piles. */
export function lyingThings(store: EntityStore): (Entity & { position: Vec3 })[] {
  const queries = [logEntities, debarkedLogEntities, stickEntities, barkEntities, bedrollEntities, pileEntities];
  return queries.flatMap((query): (Entity & { position: Vec3 })[] => [...query(store)]);
}

/** Berry bushes and mushroom patches, with food or growing back. */
export function forageSpotEntities(store: EntityStore) {
  return store.with("forageSpot", "position");
}

/** Structures placed but not finished. */
export function blueprintEntities(store: EntityStore) {
  return store.with("blueprint", "position");
}

/** Finished foundations. */
export function foundationEntities(store: EntityStore) {
  return store.with("foundation", "position");
}

/** Finished log walls and door frames. */
export function edgePieceEntities(store: EntityStore) {
  return store.with("edgePiece", "position");
}

/** Finished roof frames. */
export function roofFrameEntities(store: EntityStore) {
  return store.with("roofFrame", "position");
}

/** Finished cabin roof sections. */
export function cabinRoofEntities(store: EntityStore) {
  return store.with("cabinRoof", "position", "roof");
}

/** Finished campfires. */
export function campfireEntities(store: EntityStore) {
  return store.with("campfire", "position");
}

/** Bedrolls laid out on the ground. */
export function bedrollEntities(store: EntityStore) {
  return store.with("bedroll", "position");
}

/** The player. There is only ever one. */
export function playerEntities(store: EntityStore) {
  return store.with("player", "position", "previousPosition");
}

/** Everything that stops the player walking near it. */
export function walkBlockerEntities(store: EntityStore) {
  return store.with("blocksWalking", "position");
}

/** Everything that stops the player walking on certain squares, such as a lean-to's frame. */
export function walkBlockerSpotEntities(store: EntityStore) {
  return store.with("blocksWalkingSpots");
}

/** Everything that stops the player stepping across the edges between certain squares, such as a log wall. */
export function walkBlockerEdgeEntities(store: EntityStore) {
  return store.with("blocksWalkingEdges");
}

/** Everything with a roof. */
export function roofEntities(store: EntityStore) {
  return store.with("roof");
}

/** Finished woodpiles. */
export function woodpileEntities(store: EntityStore) {
  return store.with("woodpile", "position");
}

/** Finished chests. */
export function chestEntities(store: EntityStore) {
  return store.with("chest", "position");
}

/** Finished sleds. */
export function sledEntities(store: EntityStore) {
  return store.with("sled", "position");
}

/** Finished work stations, such as sawhorses. Blueprints are not among them. */
export function workStationEntities(store: EntityStore) {
  return store.with("workStation", "position");
}

/** Finished lean-tos. */
export function leanToEntities(store: EntityStore) {
  return store.with("leanTo", "position");
}

/** Piles of things the player dropped on the ground. */
export function pileEntities(store: EntityStore) {
  return store.with("pile", "position");
}

/** The valley's stick fall. There is only ever one. */
export function stickFallEntities(store: EntityStore) {
  return store.with("stickFall");
}

/** The valley's weather. There is only ever one. */
export function rainEntities(store: EntityStore) {
  return store.with("rain");
}
