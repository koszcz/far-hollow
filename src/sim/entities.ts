import { World } from "miniplex";
import type { ActionCommand } from "./api";
import type { CampfireFuel, CarriedLog, CarriedThing, WoodpileWood } from "./wood-and-fuel";
import type { Backpack, BackpackContent, BackpackContents, Plantable, WildFood } from "./backpack";
import type { SpoilTimes } from "./fresh-food";
import type { RecipeKind } from "./recipe-kind";
import type { Needs } from "./needs";
import type { Fire, FireKind } from "./fire";
import type { FishOnFire } from "./fish-on-fire";
import type { JugOnFire } from "./jug-on-fire";
import type { PotOnFire } from "./pot-state";
import type { FillLevel } from "./fill-level";
import type { Rain } from "./rain";
import type { Snow } from "./snow-cover";
import type { StickFallState } from "./stick-fall";
import type { Sickness } from "./sickness";
import type { BurnTime } from "./burn-time";
import type { TrapCatch } from "./trap-catch";
import type { TreeGrowth } from "./tree-growth";
import type { GroundChange } from "./ground-change";
import type { DeliveredMaterial, EdgePieceKind, FurnitureKind, GroundRect, KeptMaterial, StructureKind, WorkStationKind } from "./structure-kind";
import type { QuarterTurns } from "./quarter-turns";
import type { GroundPoint } from "./ground-point";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type { CampfireFuel, CarriedLog, CarriedThing, HeldMaterial, WoodpileWood } from "./wood-and-fuel";

/**
 * Work on a campfire, woodpile, or sled that needs the player within its reach. Out of reach, the player walks there first.
 * Each kind has the shape of the command in api.ts that asks for it, so the command can be stored as it is.
 */
/** How low the player reaches: to the ground, or out at waist height. */
export type ReachHeight = "low" | "waist";

/** What a hand reach is for, when drawing shows it its own way: the food on a forage spot, or river water for the pot. */
export type ReachingFor = WildFood | "riverWater";

export type TendTask =
  | { type: "addFuel"; campfireId: number; fuel: CampfireFuel }
  | { type: "lightCampfire" | "putOutCampfire" | "putPotOnFire" | "takePotOffFire" | "cookFish" | "takeFishOff" | "fireJug" | "takeJugOff"; campfireId: number }
  | { type: "stackOnWoodpile"; woodpileId: number; wood: WoodpileWood; all: boolean }
  | { type: "takeFromWoodpile"; woodpileId: number; wood: WoodpileWood }
  | { type: "loadSled" | "tipOutSled" | "dragSled" | "loadPlanksOnSled" | "takePlanksFromSled"; sledId: number }
  | { type: "takeFromSled"; sledId: number; log: CarriedLog };

/** What lies on a sled: how many logs, debarked logs, and planks. */
export type SledLoad = Record<CarriedLog | "plank", number>;

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
  /** The chop in progress: the tree the player is chopping, given by its entity id, and how long they have chopped it. */
  chopTask?: { treeId: number; secondsDone: number };
  /** Marks what is left of a felled tree. Its position is the middle of the stump. A sapling may grow from it. */
  stump?: true;
  /** The heading a felled tree fell toward, about the vertical axis from +z, in radians. Its logs lie along it from the stump. */
  fellHeading?: number;
  /**
   * Marks a tree growing back, with its stage and the game minutes left until the next one.
   * At the stump and sapling stages the entity is also a `stump`. Once full grown, it loses this and is a `tree` again.
   */
  growth?: TreeGrowth;
  /** Marks a log lying on the ground. Its position is the middle of the log. `heading` is the log's turn about the vertical axis, in radians. */
  log?: { heading: number };
  /** Marks a log with its bark stripped off, lying on the ground. Its position is the middle of the log. `heading` is as for `log`. */
  debarkedLog?: { heading: number };
  /**
   * Marks a mushroom log: a log on the ground the player planted a mushroom on. Its position is the middle of the log, and
   * `heading` is as for `log`. It is a log no more, so nothing that takes logs finds it. It also has a `forageSpot` for mushrooms.
   */
  mushroomLog?: { heading: number };
  /** The player is planting a mushroom on the log on the ground with this entity id, and has worked at it this long. */
  plantMushroomTask?: { logId: number; secondsDone: number };
  /** The debarking in progress: the log on the ground the player is debarking, given by its entity id, and how long they have worked at it. */
  debarkTask?: { logId: number; secondsDone: number };
  /**
   * What the entity carries outside the backpack: a log or a debarked log on the shoulder, or a plank or a stone in both hands.
   * Only one fits. A plank or stone is carried this way only when the player fetches it for a blueprint.
   */
  carrying?: CarriedThing;
  /** The sled the player drags behind them, given by its entity id. Their hands are busy until they let go. Only the player has one. */
  dragging?: { sledId: number };
  /** Marks a stick lying on the forest floor. Its position is the middle of the stick. */
  stick?: true;
  /** Marks a piece of bark lying on the ground. Its position is the middle of the bark. Bark in the backpack is not an entity. */
  bark?: true;
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
   * `delivered` counts the materials it has been given and keeps, including any already spent:
   * those the player carried to it, such as debarked logs, and the planks it took from the backpack.
   */
  blueprint?: { structure: StructureKind; progress: number; materialsSpent: number; delivered: Partial<Record<KeptMaterial, number>> };
  /**
   * The cost a blueprint or finished structure was placed with, when its structure cost something else then.
   * A chest from a save made before chests cost planks keeps its 2 debarked logs. Without this, the structure's cost applies.
   */
  builtCost?: { material: DeliveredMaterial; count: number }[];
  /**
   * Marks a swap blueprint: a window or door frame blueprint placed on a finished log wall, to be built from the wall's own logs.
   * The wall stands until the swap finishes. Then the wall goes, and the blueprint turns into the finished piece.
   * A swap costs nothing to build, and the finished piece no longer has this.
   */
  swapsWall?: true;
  /** Which way a blueprint, or the structure built from it, faces. A bedroll laid in a lean-to has it too. A bedroll without it lies along z. */
  facing?: { turns: QuarterTurns };
  /**
   * The building in progress: the blueprint the player is building, given by its entity id. Its progress lives on the blueprint.
   * `fetchFrom` is the pile, sled, or log on the ground the player is on their way to, to fetch the next stage's material.
   */
  buildTask?: { blueprintId: number; fetchFrom?: number };
  /**
   * The player fills a parked sled with the logs lying near it, one at a time.
   * `fetchFrom` is the log or debarked log on the ground they are on their way to pick up.
   */
  fillSledTask?: { sledId: number; fetchFrom?: number };
  /**
   * The taking down in progress: the blueprint or finished structure the player is taking down, given by its entity id,
   * and how long they have worked at it.
   */
  takeDownTask?: { pieceId: number; secondsDone: number };
  /**
   * Marks a finished foundation: a deck of logs covering one building-grid square, on legs down to the ground.
   * Its position is the middle of the top of the deck. The player can walk onto it and across it.
   */
  foundation?: true;
  /**
   * Marks a finished floor: planks laid flush across the deck of one foundation square.
   * Its position is the middle of that square, at the height of the foundation's deck. It changes only how the square looks.
   */
  floor?: true;
  /**
   * Marks a finished log wall or door frame. It stands on the edge of a foundation square, along the line between two squares.
   * Its position is the middle of that edge, at the height of the foundation's deck. Its `facing` says which edge of the square it is.
   */
  edgePiece?: EdgePieceKind;
  /**
   * Marks a finished door: planks hung in a finished door frame. It is not an edge piece, so the frame still holds the edge.
   * Its position and `facing` are the frame's. It never blocks walking. Whether it stands open is not part of game state:
   * `isDoorOpen` in doors.ts works it out from where the player is.
   */
  door?: true;
  /**
   * Marks finished shutters: two plank shutters hung in a finished window. They are not an edge piece, so the window still holds the edge.
   * Their position and `facing` are the window's. They never block walking. `open` says whether the player has opened them.
   * They stay as the player left them: nothing else opens or closes them.
   */
  shutters?: { open: boolean };
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
   * Marks a finished fireplace: a low stone fire box with a short chimney on one foundation square.
   * Its position is the middle of that square, at the height of the foundation's deck. Its `facing` says which side its opening faces.
   * It holds a fire. A lit fireplace in a room warms the whole room.
   */
  fireplace?: Fire;
  /**
   * Marks a finished chimney: stone built up from the cap stone of a finished fireplace, rising through any roof over it.
   * Its position and `facing` are its fireplace's. It is only for looks: it changes nothing in play and blocks no walking of its own.
   */
  chimney?: true;
  /**
   * Marks a finished campfire. Its position is the centre of the fire.
   * `fuelMinutes` is how many more game minutes its fuel can burn. A lit fire goes out when it reaches 0.
   */
  campfire?: Fire;
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
   * Marks a finished piece of furniture, with its kind. A blueprint of a piece of furniture does not have it.
   * Its position is the middle of its base, on the ground or on a foundation's deck. Its `facing` says which way it is turned.
   * src/sim/furniture.ts says what each kind is and does.
   */
  furniture?: FurnitureKind;
  /**
   * What a finished piece of furniture that stores things holds: small materials, tools, and food, grouped by
   * kind like the backpack. `contents` says how many of each kind it holds, up to the piece's weight limit in all. Logs never go in.
   * `spoilsAt` says when each fresh food in it spoils (see fresh-food.ts). Food it does not cover yet gets its full keeping time.
   */
  storage?: { contents: BackpackContents; spoilsAt?: SpoilTimes };
  /**
   * The clean water in a finished rain barrel: how many drinks it holds, up to RAIN_BARREL_DRINK_LIMIT, and how far it is
   * toward the next drink. It fills while rain falls on it. See rain-barrels.ts.
   */
  rainBarrel?: FillLevel;
  /**
   * The firewood in a finished wood box, up to WOOD_BOX_FIREWOOD_LIMIT. A fire in the same room takes firewood from it before
   * the backpack. See wood-boxes.ts.
   */
  woodBox?: { firewood: number };
  /**
   * Marks a finished sled, with how many logs, debarked logs, and planks lie on it. Its position is the middle of the ground it covers.
   * Its `facing` says which way it is turned. A sled blocks no walking, since the player drags it about.
   */
  sled?: SledLoad;
  /**
   * The way a sled points once the player has dragged it, in radians about the vertical axis, as `quarterTurnsToRadians` gives for `facing`.
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
  forageSpot?: { food: WildFood };
  /** A foraged bush or mushroom patch growing back. It has food again when `minutesLeft` game minutes have passed. */
  regrowing?: { minutesLeft: number };
  /** Marks a bedroll laid out on the ground. Its position is the middle of the bedroll. A rolled-up bedroll is in the backpack. */
  bedroll?: true;
  /**
   * The player's pending approach: the walk to get within reach of a thing or a spot, with the command that started it.
   * The command is carried out when they arrive, if the game does not refuse it then. See approach.ts.
   */
  approach?: { command: ActionCommand };
  /**
   * The player sits on a finished stool, given by its entity id, and rests. Their position stays beside it, where they stood
   * to sit down. They stand up as soon as they walk or act. It is never saved, so a loaded game starts with the player standing.
   */
  sitting?: { stoolId: number };
  /**
   * The player is reaching to pick something up or put something down: to the ground or at waist height,
   * `seconds` into the reach, toward the thing's middle if it has one. `reachingFor` says what the hand takes, when
   * drawing shows that reach its own way. It is never saved. See hand-reach.ts.
   */
  handReach?: { height: ReachHeight; seconds: number; toward?: GroundPoint; reachingFor?: ReachingFor };
  /** Hunger, thirst, warmth, and fatigue. Only the player has needs. */
  needs?: Needs;
  /** Where the entity wakes after a collapse. Only the player has one. */
  respawnPoint?: GroundPoint;
  /**
   * The fishing in progress, on the river bank. The spot is where the player clicked on the river.
   * `minutesWaited` counts the game minutes since the latest cast. A fish bites after `biteAfterMinutes`.
   */
  fishTask?: { x: number; z: number; minutesWaited: number; biteAfterMinutes: number };
  /** How many times the player has cast a fishing line so far. It picks the wait for the next cast. Missing before the first. */
  fishCasts?: number;
  /** The stone gathering in progress: the player is gathering one stone at this spot on the river bank or in the river. */
  stoneTask?: { x: number; z: number; secondsDone: number };
  /** The clay digging in progress: the player is digging one clay at this spot on the river bank or in the river. */
  clayTask?: { x: number; z: number; secondsDone: number };
  /** The player is digging up the sapling or berry bush with this entity id, and has worked at it this long. */
  digUpTask?: { thingId: number; secondsDone: number };
  /** The player is planting a sapling or berry bush, as `plant` says, at this spot, and has worked at it this long. */
  plantTask?: { x: number; z: number; secondsDone: number; plant: Plantable };
  /** The player is sick, so their needs drain faster. Missing when they are well. */
  sickness?: Sickness;
  /**
   * The lit torch in the player's hand, with how long it still burns. Missing when they hold none.
   * It is not a backpack content, so it uses no backpack weight. Only the player has one.
   */
  litTorch?: BurnTime;
  /**
   * Marks a lit torch planted in the ground, with how long it still burns. Its position is the spot where it stands,
   * on the ground or on a foundation. It does not block walking.
   */
  plantedTorch?: BurnTime;
  /**
   * Marks a fish trap set in the river's water, with whether it holds a fish and how long until it catches the next one.
   * Its position is the spot in the water just inside the edge, where it sits. It does not block walking. See fish-traps.ts.
   */
  fishTrap?: TrapCatch;
  /** The full pot sitting on this campfire. Only campfires have one. */
  potOnFire?: PotOnFire;
  /** The fish on this campfire, raw or cooked, in the order they went on. Only campfires have them. Missing when it holds none. */
  fishOnFire?: FishOnFire[];
  /** The jug firing on this campfire or fireplace, unfired or fired. A fire holds one at a time. Missing when it holds none. */
  jugOnFire?: JugOnFire;
  /** Whether rain is falling in the valley, and until when. Only one entity, the valley's weather, has it. */
  rain?: Rain;
  /**
   * What winter does to the valley's weather now: whether rain falls as snow, and how deep the snow cover lies.
   * Only the valley's weather has it. Game logic sets it from the calendar as time passes. It is not saved.
   */
  snow?: Snow;
  /** When the next sticks fall from the trees. Only one entity, the valley's stick fall, has it. */
  stickFall?: StickFallState;
  /**
   * The latest change of ground type around one tree spot: forest floor turning into clearing where a tree went for good,
   * or clearing turning into forest floor round a new full tree. One entity holds each spot's change. See ground-changes.ts.
   */
  groundChange?: GroundChange;
  /**
   * Marks a pile: things of one kind the player dropped from the backpack, lying on the ground. Its position is the middle of the pile.
   * `count` is how many it holds, always at least 1. A pile with nothing left is removed.
   * `spoilsAt` says when each fresh food in it spoils (see fresh-food.ts). Food it does not cover yet gets its full keeping time.
   */
  pile?: { content: BackpackContent; count: number; spoilsAt?: SpoilTimes };
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
 * Crafting in progress, a reach in progress, and sitting are left out, because they are never saved.
 */
export function saveEntities(store: EntityStore): SavedEntity[] {
  const saved: SavedEntity[] = [];
  for (const entity of store.entities) {
    const id = store.id(entity);
    if (id === undefined) continue;
    if (entity.craftTask === undefined && entity.handReach === undefined && entity.sitting === undefined && entity.snow === undefined) {
      saved.push({ id, components: entity });
      continue;
    }
    const components = { ...entity };
    delete components.craftTask;
    delete components.handReach;
    delete components.sitting;
    delete components.snow;
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

/** Trees growing back: stumps, saplings, and young trees. */
export function growingTreeEntities(store: EntityStore) {
  return store.with("growth", "position");
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

/** Everything lying loose on the ground that the player can pick up: logs, debarked logs, sticks, bark, bedrolls, piles, and planted torches. */
export function lyingThings(store: EntityStore): (Entity & { position: Vec3 })[] {
  const queries = [logEntities, debarkedLogEntities, stickEntities, barkEntities, bedrollEntities, pileEntities, plantedTorchEntities];
  return queries.flatMap((query): (Entity & { position: Vec3 })[] => [...query(store)]);
}

/** Mushroom logs, with mushrooms or growing them back. */
export function mushroomLogEntities(store: EntityStore) {
  return store.with("mushroomLog", "position");
}

/** Berry bushes, mushroom patches, and mushroom logs, with food or growing back. */
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

/** Finished floors. */
export function floorEntities(store: EntityStore) {
  return store.with("floor", "position");
}

/** Finished log walls and door frames. */
export function edgePieceEntities(store: EntityStore) {
  return store.with("edgePiece", "position");
}

/** Finished doors. */
export function doorEntities(store: EntityStore) {
  return store.with("door", "position");
}

/** Finished shutters. */
export function shuttersEntities(store: EntityStore) {
  return store.with("shutters", "position");
}

/** Finished roof frames. */
export function roofFrameEntities(store: EntityStore) {
  return store.with("roofFrame", "position");
}

/** Finished cabin roof sections. */
export function cabinRoofEntities(store: EntityStore) {
  return store.with("cabinRoof", "position", "roof");
}

/** Finished fireplaces. */
export function fireplaceEntities(store: EntityStore) {
  return store.with("fireplace", "position");
}

/** Finished chimneys. */
export function chimneyEntities(store: EntityStore) {
  return store.with("chimney", "position");
}

/** A finished campfire or fireplace, which kind it is, and the fire it holds. Set the fire back on `entity[kind]` to change it. */
export interface HeldFire {
  readonly entity: Entity & { position: Vec3 };
  readonly kind: FireKind;
  readonly fire: Fire;
}

/** The fire an entity holds, if it is a finished campfire or fireplace. */
export function heldFireOf(entity: Entity | undefined): HeldFire | undefined {
  if (entity === undefined || !hasPosition(entity)) return undefined;
  if (entity.campfire !== undefined) return { entity, kind: "campfire", fire: entity.campfire };
  if (entity.fireplace !== undefined) return { entity, kind: "fireplace", fire: entity.fireplace };
  return undefined;
}

/** Every finished campfire and fireplace, with the fire it holds. */
export function heldFires(store: EntityStore): HeldFire[] {
  return [...campfireEntities(store), ...fireplaceEntities(store)].flatMap((entity) => heldFireOf(entity) ?? []);
}

function hasPosition(entity: Entity): entity is Entity & { position: Vec3 } {
  return entity.position !== undefined;
}

/** Finished campfires. */
export function campfireEntities(store: EntityStore) {
  return store.with("campfire", "position");
}

/** Lit torches planted in the ground or on a foundation. */
export function plantedTorchEntities(store: EntityStore) {
  return store.with("plantedTorch", "position");
}

/** Fish traps set in the river's water. */
export function fishTrapEntities(store: EntityStore) {
  return store.with("fishTrap", "position");
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

/** Finished pieces of furniture, of every kind. Code that needs one kind filters by `furniture`. Blueprints are not among them. */
export function furnitureEntities(store: EntityStore) {
  return store.with("furniture", "position");
}

/** Finished sleds. */
export function sledEntities(store: EntityStore) {
  return store.with("sled", "position");
}

/** Whether a sled is parked: no player drags it. A dragged sled is not parked. */
export function isParked(store: EntityStore, sled: Entity): boolean {
  const id = store.id(sled);
  return playerEntities(store).entities.every((player) => player.dragging?.sledId !== id);
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

/** The changes of ground type, one for each tree spot that has had one. */
export function groundChangeEntities(store: EntityStore) {
  return store.with("groundChange");
}

/** The valley's weather. There is only ever one. */
export function rainEntities(store: EntityStore) {
  return store.with("rain");
}

/** Whether rain, not snow, falls in the valley now. False before the weather exists. */
export function isRaining(store: EntityStore): boolean {
  const weather = rainEntities(store).first;
  return weather?.rain.falling === true && weather.snow?.fallsAsSnow !== true;
}

/** Whether snow falls in the valley now, in place of rain. False before the weather exists. */
export function isSnowing(store: EntityStore): boolean {
  const weather = rainEntities(store).first;
  return weather?.rain.falling === true && weather.snow?.fallsAsSnow === true;
}

/** How deep the snow cover lies in the valley now, from 0 (none) to 1 (full). 0 before the weather exists. */
export function snowCoverDepth(store: EntityStore): number {
  return rainEntities(store).first?.snow?.cover.depth ?? 0;
}
