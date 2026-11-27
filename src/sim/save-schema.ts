// Checks that stored data has the shape of a save, so a broken save is turned away before the game loads it.
import type { BackpackContent } from "./api";
import type { ActionCommand } from "./api-commands";
import type { GameNotice } from "./api-notice";
import type { PlainRefusal } from "./api-refusal";
import { CONTENT_WEIGHT_KG } from "./backpack";
import type { Entity } from "./entities";
import { isFillProgress } from "./fill-level";
import { GOALS } from "./journal";
import { FISH_ON_FIRE_LIMIT } from "./fish-on-fire";
import { DRYING_RACK_FOOD_LIMIT, FOODS_TO_HANG, RACK_FOODS } from "./rack-food";
import { FRESH_FOODS } from "./fresh-food";
import { WOOD_BOX_FIREWOOD_LIMIT } from "./furniture/wood-box";
import { NEED_KINDS } from "./needs";
import { RECIPE_KINDS } from "./recipe-kind";
import { EDGE_PIECE_KINDS, FURNITURE_KINDS, WORK_STATION_KINDS } from "./structure-kind";
import { isDelivered, isKept, STRUCTURES } from "./structures";
import { GROWTH_STAGES } from "./tree-growth";
import { CAMPFIRE_FUELS, CARRIED_LOGS, CARRIED_THINGS, WOODPILE_WOODS } from "./wood-and-fuel";

/** Says whether a value has the right shape. */
type Check = (value: unknown) => boolean;

const finite: Check = (value) => typeof value === "number" && Number.isFinite(value);
const count: Check = (value) => Number.isSafeInteger(value) && (value as number) >= 0;
const boolean: Check = (value) => typeof value === "boolean";
const exactly =
  (...allowed: unknown[]): Check =>
  (value) =>
    allowed.includes(value);

/** A plain object with exactly these keys. Keys listed in `optional` may be missing. */
function shape(fields: Record<string, Check>, optional: readonly string[] = []): Check {
  return (value) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const record = value as Record<string, unknown>;
    if (Object.keys(record).some((key) => !(key in fields))) return false;
    return Object.entries(fields).every(([key, check]) => (optional.includes(key) && record[key] === undefined) || check(record[key]));
  };
}

const list =
  (item: Check): Check =>
  (value) =>
    Array.isArray(value) && value.every(item);

const point = shape({ x: finite, z: finite });
/** How many of each fresh food kind. A kind that is missing counts as none. */
const freshCounts: Check = shape(Object.fromEntries(FRESH_FOODS.map((food) => [food, count])), FRESH_FOODS);
/** When each fresh food in a holder spoils, by kind, soonest first. */
const spoilTimes: Check = shape(
  Object.fromEntries(
    FRESH_FOODS.map((food) => [
      food,
      (value: unknown) => list(finite)(value) && (value as number[]).every((time, index, all) => index === 0 || (all[index - 1] ?? time) <= time),
    ]),
  ),
  FRESH_FOODS,
);
const vec3 = shape({ x: finite, y: finite, z: finite });
const backpackContents: Check = (value) =>
  shape(Object.fromEntries(Object.keys(CONTENT_WEIGHT_KG).map((content) => [content, count])), Object.keys(CONTENT_WEIGHT_KG))(value);
/** Every material a blueprint keeps once it has it. */
const DELIVERED_MATERIALS = [...new Set(STRUCTURES.flatMap(({ cost }) => cost.flatMap(({ material }) => (isKept(material) ? [material] : []))))];
/** Every material carried to a blueprint on the shoulder, which an older cost may name. */
const CARRIED_MATERIALS = [...new Set(STRUCTURES.flatMap(({ cost }) => cost.flatMap(({ material }) => (isDelivered(material) ? [material] : []))))];
const deliveredCounts: Check = shape(Object.fromEntries(DELIVERED_MATERIALS.map((material) => [material, count])), DELIVERED_MATERIALS);

const fuel = exactly(...CAMPFIRE_FUELS);
const wood = exactly(...WOODPILE_WOODS);
const backpackContent = exactly(...(Object.keys(CONTENT_WEIGHT_KG) as BackpackContent[]));

/** The check for one command type: its `type` and the fields it carries. Fields in `optional` may be missing. */
const commandOf = (type: string, fields: Record<string, Check> = {}, optional: readonly string[] = []): Check =>
  shape({ type: exactly(type), ...fields }, optional);
const at = { x: finite, z: finite };
const atSpot = (type: string) => commandOf(type, at);
const onCampfire = (type: string) => commandOf(type, { campfireId: count });
const onSled = (type: string) => commandOf(type, { sledId: count });
const onBarrel = (type: string) => commandOf(type, { barrelId: count });
const onLog = (type: string) => commandOf(type, { logId: count });

/**
 * How each action command must look when a pending approach stores it.
 * Every `ActionCommand` type needs an entry here. TypeScript reports a missing one.
 */
const COMMAND_CHECKS: { readonly [Type in ActionCommand["type"]]: Check } = {
  setPaused: commandOf("setPaused", { paused: boolean }),
  walkTo: atSpot("walkTo"),
  chopTree: commandOf("chopTree", { treeId: count }),
  digUpSapling: commandOf("digUpSapling", { saplingId: count }),
  plantSapling: atSpot("plantSapling"),
  digUpBerryBush: commandOf("digUpBerryBush", { bushId: count }),
  plantBerryBush: atSpot("plantBerryBush"),
  pickUpLog: onLog("pickUpLog"),
  debarkLog: onLog("debarkLog"),
  plantMushroom: onLog("plantMushroom"),
  takeDownMushroomLog: commandOf("takeDownMushroomLog", { mushroomLogId: count }),
  pickUpStick: commandOf("pickUpStick", { stickId: count }),
  pickUpBark: commandOf("pickUpBark", { barkId: count }),
  forage: commandOf("forage", { spotId: count }),
  eat: commandOf("eat", { food: exactly("berries", "mushroom", "rawFish", "cookedFish", "driedBerries", "driedMushroom", "smokedFish") }),
  splitLog: commandOf("splitLog", { logId: count }, ["logId"]),
  dropLog: commandOf("dropLog"),
  dropLogAt: atSpot("dropLogAt"),
  dropFromBackpack: commandOf("dropFromBackpack", { content: backpackContent }),
  pickUpPile: commandOf("pickUpPile", { pileId: count }),
  placeBlueprint: commandOf(
    "placeBlueprint",
    { ...at, structure: exactly(...STRUCTURES.map(({ kind }) => kind)), turns: exactly(0, 1, 2, 3), thenBuild: boolean },
    ["thenBuild"],
  ),
  buildAddOn: commandOf("buildAddOn", { hostId: count }),
  build: commandOf("build", { blueprintId: count }),
  deliverToBlueprint: commandOf("deliverToBlueprint", { blueprintId: count }),
  takeDown: commandOf("takeDown", { pieceId: count }),
  stopBuilding: commandOf("stopBuilding"),
  tendCampfire: onCampfire("tendCampfire"),
  addFuel: commandOf("addFuel", { campfireId: count, fuel }),
  tendWoodpile: commandOf("tendWoodpile", { woodpileId: count }),
  stackOnWoodpile: commandOf("stackOnWoodpile", { woodpileId: count, wood, all: boolean }),
  takeFromWoodpile: commandOf("takeFromWoodpile", { woodpileId: count, wood }),
  loadSled: onSled("loadSled"),
  takeFromSled: commandOf("takeFromSled", { sledId: count, log: exactly(...CARRIED_LOGS) }),
  loadPlanksOnSled: onSled("loadPlanksOnSled"),
  takePlanksFromSled: onSled("takePlanksFromSled"),
  tipOutSled: onSled("tipOutSled"),
  dragSled: onSled("dragSled"),
  letGoOfSled: commandOf("letGoOfSled"),
  fillSled: onSled("fillSled"),
  openChest: commandOf("openChest", { chestId: count }),
  putInChest: commandOf("putInChest", { chestId: count, content: backpackContent, all: boolean }),
  takeFromChest: commandOf("takeFromChest", { chestId: count, content: backpackContent, all: boolean }),
  lightCampfire: onCampfire("lightCampfire"),
  putOutCampfire: onCampfire("putOutCampfire"),
  layBedroll: commandOf("layBedroll"),
  layBedrollInLeanTo: commandOf("layBedrollInLeanTo", { leanToId: count }),
  pickUpBedroll: commandOf("pickUpBedroll", { bedrollId: count }),
  sleep: commandOf("sleep", { bedrollId: count }),
  sleepInBed: commandOf("sleepInBed", { bedId: count }),
  sitOnStool: commandOf("sitOnStool", { stoolId: count }),
  drinkFromRiver: atSpot("drinkFromRiver"),
  fish: atSpot("fish"),
  setFishTrap: atSpot("setFishTrap"),
  takeFishFromTrap: commandOf("takeFishFromTrap", { trapId: count }),
  pickUpFishTrap: commandOf("pickUpFishTrap", { trapId: count }),
  gatherStone: atSpot("gatherStone"),
  digClay: atSpot("digClay"),
  fillPot: commandOf("fillPot"),
  drinkFromPot: commandOf("drinkFromPot"),
  pourIntoJug: commandOf("pourIntoJug"),
  drinkFromJug: commandOf("drinkFromJug"),
  drinkFromRainBarrel: onBarrel("drinkFromRainBarrel"),
  fillPotFromRainBarrel: onBarrel("fillPotFromRainBarrel"),
  fillJugFromRainBarrel: onBarrel("fillJugFromRainBarrel"),
  hangOnRack: commandOf("hangOnRack", { rackId: count, food: exactly(...FOODS_TO_HANG) }),
  takeFoodOffRack: commandOf("takeFoodOffRack", { rackId: count }),
  putInWoodBox: commandOf("putInWoodBox", { woodBoxId: count, all: boolean }),
  takeFromWoodBox: commandOf("takeFromWoodBox", { woodBoxId: count }),
  putPotOnFire: onCampfire("putPotOnFire"),
  takePotOffFire: onCampfire("takePotOffFire"),
  cookFish: onCampfire("cookFish"),
  takeFishOff: onCampfire("takeFishOff"),
  fireJug: onCampfire("fireJug"),
  takeJugOff: onCampfire("takeJugOff"),
  craft: commandOf("craft", { recipe: exactly(...RECIPE_KINDS), stationId: count }, ["stationId"]),
  lightTorch: commandOf("lightTorch"),
  putOutTorch: commandOf("putOutTorch"),
  plantTorch: commandOf("plantTorch"),
  pickUpTorch: commandOf("pickUpTorch", { torchId: count }),
  setShutters: commandOf("setShutters", { shuttersId: count, open: boolean }),
  setJournalHidden: commandOf("setJournalHidden", { hidden: boolean }),
  skipTime: commandOf("skipTime", { hours: finite }),
  skipToRainChange: commandOf("skipToRainChange"),
  skipToSeason: commandOf("skipToSeason"),
};

/** A command the player is on their way to carry out, which a pending approach holds. */
const approachCommand: Check = (value) => {
  const type = (value as { type?: unknown } | null)?.type;
  return typeof type === "string" && Object.hasOwn(COMMAND_CHECKS, type) && COMMAND_CHECKS[type as ActionCommand["type"]](value);
};

/**
 * How each entity component must look in a save.
 * Every component of an entity needs an entry here. TypeScript reports a missing one,
 * so a new component is saved and checked as soon as it is added here.
 */
const COMPONENT_CHECKS: { readonly [Component in keyof Entity]-?: Check } = {
  position: vec3,
  previousPosition: vec3,
  tree: exactly(true),
  player: exactly(true),
  walkPath: list(point),
  approach: shape({ command: approachCommand }),
  blocksWalking: shape({ radius: finite }),
  blocksWalkingSpots: list(point),
  blocksWalkingEdges: list(shape({ from: point, to: point })),
  backpack: shape({ contents: backpackContents, spoilsAt: spoilTimes }, ["spoilsAt"]),
  chopTask: shape({ treeId: count, secondsDone: finite }),
  stump: exactly(true),
  fellHeading: finite,
  growth: shape({ stage: exactly(...GROWTH_STAGES), minutesLeft: finite }),
  log: shape({ heading: finite }),
  debarkedLog: shape({ heading: finite }),
  mushroomLog: shape({ heading: finite }),
  plantMushroomTask: shape({ logId: count, secondsDone: finite }),
  debarkTask: shape({ logId: count, secondsDone: finite }),
  carrying: exactly(...CARRIED_THINGS),
  dragging: shape({ sledId: count }),
  stick: exactly(true),
  bark: exactly(true),
  splitTask: shape({ secondsDone: finite }),
  // Crafting in progress is never saved, so no save holds it.
  craftTask: () => false,
  // Nor is a reach in progress.
  handReach: () => false,
  // Nor is sitting on a stool.
  sitting: () => false,
  // Nor is the snow, which follows the calendar.
  snow: () => false,
  blueprint: shape({ structure: exactly(...STRUCTURES.map(({ kind }) => kind)), progress: finite, materialsSpent: count, delivered: deliveredCounts }),
  builtCost: list(shape({ material: exactly(...CARRIED_MATERIALS), count: (value) => count(value) && (value as number) > 0 })),
  swapsWall: exactly(true),
  facing: shape({ turns: exactly(0, 1, 2, 3) }),
  buildTask: shape({ blueprintId: count, fetchFrom: count }, ["fetchFrom"]),
  fillSledTask: shape({ sledId: count, fetchFrom: count }, ["fetchFrom"]),
  takeDownTask: shape({ pieceId: count, secondsDone: finite }),
  foundation: exactly(true),
  floor: exactly(true),
  edgePiece: exactly(...EDGE_PIECE_KINDS),
  door: exactly(true),
  shutters: shape({ open: boolean }),
  roofFrame: exactly(true),
  cabinRoof: exactly(true),
  fireplace: shape({ lit: boolean, fuelMinutes: finite }),
  chimney: exactly(true),
  campfire: shape({ lit: boolean, fuelMinutes: finite }),
  onFoundation: point,
  furniture: exactly(...FURNITURE_KINDS),
  storage: shape({ contents: backpackContents, spoilsAt: spoilTimes }, ["spoilsAt"]),
  rainBarrel: shape({ held: count, progress: isFillProgress }),
  // Preserved food has no spoil time.
  dryingRack: (value) =>
    list(shape({ food: exactly(...RACK_FOODS), minutesPreserved: finite, spoilsAt: finite }, ["spoilsAt"]))(value) &&
    (value as unknown[]).length <= DRYING_RACK_FOOD_LIMIT,
  woodBox: shape({ firewood: (value) => count(value) && (value as number) <= WOOD_BOX_FIREWOOD_LIMIT }),
  workStation: exactly(...WORK_STATION_KINDS),
  sled: shape({ log: count, debarkedLog: count, plank: count }),
  dragHeading: finite,
  leanTo: exactly(true),
  woodpile: shape({ log: count, debarkedLog: count, firewood: count }),
  roof: shape({ min: point, max: point }),
  forageSpot: shape({ food: exactly("berries", "mushroom") }),
  regrowing: shape({ minutesLeft: finite }),
  bedroll: exactly(true),
  needs: shape(Object.fromEntries(NEED_KINDS.map((kind) => [kind, shape({ level: finite, minutesWithout: finite })]))),
  respawnPoint: point,
  fishTask: shape({ x: finite, z: finite, minutesWaited: finite, biteAfterMinutes: finite }),
  fishCasts: count,
  stoneTask: shape({ x: finite, z: finite, secondsDone: finite }),
  clayTask: shape({ x: finite, z: finite, secondsDone: finite }),
  digUpTask: shape({ thingId: count, secondsDone: finite }),
  plantTask: shape({ x: finite, z: finite, secondsDone: finite, plant: exactly("sapling", "berryBush") }),
  sickness: shape({ minutesLeft: finite }),
  litTorch: shape({ minutesLeft: finite }),
  plantedTorch: shape({ minutesLeft: finite }),
  fishTrap: shape({ holding: boolean, minutesToNext: finite, draws: count }),
  potOnFire: shape({ water: exactly("river", "boiled"), minutesBoiling: finite }),
  fishOnFire: (value) => list(shape({ minutesCooked: finite }))(value) && (value as unknown[]).length > 0 && (value as unknown[]).length <= FISH_ON_FIRE_LIMIT,
  jugOnFire: shape({ minutesFired: finite }),
  rain: shape({ falling: boolean, changeAtMinutes: finite, changes: count }),
  // Saves from before falls were owed have no `owed`.
  stickFall: shape({ minutesToNext: finite, falls: count, owed: count }, ["owed"]),
  groundChange: shape({ x: finite, z: finite, toward: exactly("clearing", "forestFloor"), startedAtMinutes: finite }),
  // Dropped sticks lie on the ground one by one, so a pile never holds sticks.
  pile: shape(
    {
      content: exactly(...Object.keys(CONTENT_WEIGHT_KG).filter((content) => content !== "stick")),
      count: (value) => count(value) && (value as number) > 0,
      spoilsAt: spoilTimes,
    },
    ["spoilsAt"],
  ),
};

const components: Check = shape(COMPONENT_CHECKS, Object.keys(COMPONENT_CHECKS));

const workStation = exactly(...WORK_STATION_KINDS);

/** One thing a recipe lacks, as a notice that the player cannot craft it yet lists it. */
const recipeLack: Check = (value) =>
  shape({ kind: exactly("tool"), tool: exactly(...(Object.keys(CONTENT_WEIGHT_KG) as BackpackContent[])) })(value) ||
  shape({ kind: exactly("station"), station: workStation })(value) ||
  shape({ kind: exactly("materials") })(value);

/** Each refusal that needs nothing more than its kind. TypeScript reports a missing kind. */
const PLAIN_REFUSALS: Readonly<Record<PlainRefusal, true>> = {
  fireEmpty: true,
  fireFull: true,
  lightFirst: true,
  noPotOfWater: true,
  noRawFish: true,
  fireFullOfFish: true,
  noUnfiredJug: true,
  noPotOfCleanWater: true,
  noJug: true,
  noJugWithRoom: true,
  noWaterInJug: true,
  fireHoldsJug: true,
  woodpileFull: true,
  sledFull: true,
  noLogsNearSled: true,
  letGoFirst: true,
  shoulderFull: true,
  handsFull: true,
  putLogDownFirst: true,
  noLogCarried: true,
  nothingToTake: true,
  emptyFirst: true,
  potOnFire: true,
  fishOnFire: true,
  jugOnFire: true,
  fireNotOut: true,
  holdsUpPiece: true,
  tooYoungToChop: true,
  noSaplingYet: true,
  tooBigToDigUp: true,
  noSapling: true,
  noBerryBush: true,
  tooCloseToBerryBush: true,
  tooCloseToMushroomLog: true,
  berryBushInTheWay: true,
  notPlantableGround: true,
  tooCloseToTree: true,
  tooCloseToStructure: true,
  backpackFull: true,
  torchAlreadyLit: true,
  gone: true,
  openFirst: true,
  torchTooClose: true,
  noLitTorch: true,
  noMushroom: true,
  needsPlainLog: true,
  mushroomLogInTheWay: true,
  barrelEmpty: true,
  noEmptyPot: true,
  noFishTrap: true,
  fishTrapTooClose: true,
  takeFishFirst: true,
  atCorner: true,
  takeShuttersDownFirst: true,
  nothingGrowsInWinter: true,
  riverFrozen: true,
  chimneyNeedsFireplace: true,
  fireplaceHasChimney: true,
  takeChimneyDownFirst: true,
  finishHostFirst: true,
  holdsAddOn: true,
  addOnInTheWay: true,
  noBerries: true,
  rackFull: true,
  onlyRawFishSmokes: true,
  needsRoom: true,
  woodBoxFull: true,
  woodBoxEmpty: true,
};

/** Why the game refused a command, as a notice names it. */
const refusal: Check = (value) =>
  shape({ kind: exactly(...Object.keys(PLAIN_REFUSALS)) })(value) ||
  shape({ kind: exactly("needsTool"), tool: backpackContent })(value) ||
  shape({ kind: exactly("noContent"), content: exactly(...CAMPFIRE_FUELS, "plank") })(value) ||
  shape({
    kind: exactly("cannotBuildYet"),
    lacks: (lacks) =>
      shape({ kind: exactly("tool"), tool: backpackContent })(lacks) ||
      shape({ kind: exactly("material"), material: exactly("stick", "bark", "cord", "plank", "stone", ...CARRIED_LOGS) })(lacks),
  })(value) ||
  shape({ kind: exactly("cannotCraftYet"), lacks: list(recipeLack) })(value);

/**
 * How each kind of notice must look in a save, besides the game minute it stops showing at.
 * TypeScript reports a missing kind.
 */
const NOTICES: { readonly [Kind in GameNotice]: Record<string, Check> } = {
  collapsed: {},
  survivedFirstNight: {},
  snugRoomKeepsOutCold: {},
  backpackFull: {},
  chestFull: {},
  shelfFull: {},
  holdsUpPiece: {},
  stillHoldsSomething: {},
  saveBroken: {},
  putLogDownFirst: {},
  letGoFirst: {},
  noLogBesideStation: { station: workStation },
  cannotCraftYet: { lacks: list(recipeLack) },
  fishGotAway: {},
  droppedBesideStation: { content: backpackContent, count, station: workStation },
  queueFull: {},
  cannotQueue: { refusal },
  actionSkipped: { refusal },
  refused: { refusal },
  foodSpoiled: { spoiled: freshCounts },
  cantGetThere: {},
};

/** A saved notice: its kind, what that kind names, and the game minute it stops showing at. */
const notice: Check = (value) => {
  const kind = (value as { kind?: unknown } | null)?.kind;
  if (typeof kind !== "string" || !Object.hasOwn(NOTICES, kind)) return false;
  return shape({ kind: exactly(kind), untilMinutes: finite, ...NOTICES[kind as GameNotice] })(value);
};

/** The components the player always has. */
const PLAYER_COMPONENTS = ["position", "previousPosition", "backpack", "needs", "respawnPoint"] as const;

const saveShape = shape({
  version: count,
  seed: (value) => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) < 2 ** 32,
  clockMinutes: (value) => finite(value) && (value as number) >= 0,
  yearStartDay: (value) => Number.isSafeInteger(value) && (value as number) >= 1,
  stepCount: count,
  firstNightOver: boolean,
  snugRoomNoticeShown: boolean,
  journal: shape({ done: list(exactly(...GOALS)), hidden: boolean }),
  notice: (value) => value === null || notice(value),
  entities: list(shape({ id: count, components })),
});

/** True if the data has the shape of a save at the newest version: plain data the game can load. */
export function isValidSave(data: unknown): boolean {
  if (!saveShape(data)) return false;
  const entities = (data as { entities: { id: number; components: Entity }[] }).entities;
  if (new Set(entities.map((entity) => entity.id)).size !== entities.length) return false;
  const players = entities.filter((entity) => entity.components.player === true);
  return players.length === 1 && PLAYER_COMPONENTS.every((component) => players[0]?.components[component] !== undefined);
}

/**
 * Removes every `approach` whose command fails its check, and keeps the rest of the save, so the player still has their walk.
 * It is the one component a bad value does not turn the save away for. It warns with the command type of each one it drops.
 * It changes nothing else, and does not change `data`.
 */
export function dropBadApproaches(data: unknown): unknown {
  const entities = (data as { entities?: unknown } | null)?.entities;
  if (!Array.isArray(entities)) return data;
  const kept = (entities as unknown[]).map((entity) => {
    const components = (entity as { components?: Record<string, unknown> } | null)?.components;
    const approach: unknown = components?.approach;
    if (typeof approach !== "object" || approach === null || shape({ command: approachCommand })(approach)) return entity;
    const command = (approach as { command?: unknown }).command;
    console.warn(`Dropped a saved approach with a bad command: ${String((command as { type?: unknown } | null | undefined)?.type)}`);
    const { approach: _approach, ...rest } = components ?? {};
    return { ...(entity as object), components: rest };
  });
  return kept.some((entity, index) => entity !== entities[index]) ? { ...(data as object), entities: kept } : data;
}
