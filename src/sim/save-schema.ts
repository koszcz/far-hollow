// Checks that stored data has the shape of a save, so a broken save is turned away before the game loads it.
import type { BackpackContent, GameNotice } from "./api";
import { CONTENT_WEIGHT_KG } from "./backpack";
import type { Entity } from "./entities";
import { NEED_KINDS } from "./needs";
import { EDGE_PIECE_KINDS, WORK_STATION_KINDS } from "./structure-kind";
import { isDelivered, STRUCTURES } from "./structures";
import { CAMPFIRE_FUELS, CARRIED_LOGS, WOODPILE_WOODS } from "./wood-and-fuel";

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
const vec3 = shape({ x: finite, y: finite, z: finite });
const backpackContents: Check = (value) =>
  shape(Object.fromEntries(Object.keys(CONTENT_WEIGHT_KG).map((content) => [content, count])), Object.keys(CONTENT_WEIGHT_KG))(value);
/** Every material the player carries to a blueprint. */
const DELIVERED_MATERIALS = [...new Set(STRUCTURES.flatMap(({ cost }) => cost.flatMap(({ material }) => (isDelivered(material) ? [material] : []))))];
const deliveredCounts: Check = shape(Object.fromEntries(DELIVERED_MATERIALS.map((material) => [material, count])), DELIVERED_MATERIALS);

const fuel = exactly(...CAMPFIRE_FUELS);
const wood = exactly(...WOODPILE_WOODS);
/** A campfire or woodpile command the player is walking to carry out. */
const tendCommand: Check = (value) =>
  shape({ type: exactly("addFuel"), campfireId: count, fuel })(value) ||
  shape({ type: exactly("lightCampfire", "putPotOnFire", "takePotOffFire"), campfireId: count })(value) ||
  shape({ type: exactly("stackOnWoodpile"), woodpileId: count, wood, all: boolean })(value) ||
  shape({ type: exactly("takeFromWoodpile"), woodpileId: count, wood })(value);

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
  blocksWalking: shape({ radius: finite }),
  blocksWalkingSpots: list(point),
  blocksWalkingEdges: list(shape({ from: point, to: point })),
  backpack: shape({ contents: backpackContents }),
  chopTask: shape({ treeId: count, secondsDone: finite }),
  logPickUpTask: shape({ logId: count }),
  stump: exactly(true),
  log: shape({ heading: finite }),
  debarkedLog: shape({ heading: finite }),
  debarkTask: shape({ logId: count, secondsDone: finite }),
  carrying: exactly(...CARRIED_LOGS),
  stick: exactly(true),
  stickPickUpTask: shape({ stickId: count }),
  bark: exactly(true),
  barkPickUpTask: shape({ barkId: count }),
  splitTask: shape({ secondsDone: finite }),
  // Crafting in progress is never saved, so no save holds it.
  craftTask: () => false,
  blueprint: shape({ structure: exactly(...STRUCTURES.map(({ kind }) => kind)), progress: finite, materialsSpent: count, delivered: deliveredCounts }),
  facing: shape({ turns: exactly(0, 1, 2, 3) }),
  buildTask: shape({ blueprintId: count }),
  deliverTask: shape({ blueprintId: count }),
  takeDownTask: shape({ pieceId: count, secondsDone: finite }),
  foundation: exactly(true),
  edgePiece: exactly(...EDGE_PIECE_KINDS),
  roofFrame: exactly(true),
  cabinRoof: exactly(true),
  campfire: shape({ lit: boolean, fuelMinutes: finite }),
  onFoundation: point,
  chest: shape({ contents: backpackContents }),
  workStation: exactly(...WORK_STATION_KINDS),
  sled: shape({ log: count, debarkedLog: count }),
  leanTo: exactly(true),
  woodpile: shape({ log: count, debarkedLog: count, firewood: count }),
  roof: shape({ min: point, max: point }),
  forageSpot: shape({ food: exactly("berries", "mushroom") }),
  regrowing: shape({ minutesLeft: finite }),
  forageTask: shape({ spotId: count }),
  bedroll: exactly(true),
  bedrollTask: shape({ bedrollId: count, then: exactly("pickUp", "sleep") }),
  tendTask: tendCommand,
  needs: shape(Object.fromEntries(NEED_KINDS.map((kind) => [kind, shape({ level: finite, minutesWithout: finite })]))),
  respawnPoint: point,
  drinkTask: point,
  sickness: shape({ minutesLeft: finite }),
  fillPotTask: point,
  potOnFire: shape({ water: exactly("river", "boiled"), minutesBoiling: finite }),
  rain: shape({ falling: boolean, changeAtMinutes: finite, changes: count }),
  // Dropped sticks lie on the ground one by one, so a pile never holds sticks.
  pile: shape({
    content: exactly(...Object.keys(CONTENT_WEIGHT_KG).filter((content) => content !== "stick")),
    count: (value) => count(value) && (value as number) > 0,
  }),
  pileTask: shape({ pileId: count }),
};

const components: Check = shape(COMPONENT_CHECKS, Object.keys(COMPONENT_CHECKS));

const workStation = exactly(...WORK_STATION_KINDS);

/** One thing a recipe lacks, as a notice that the player cannot craft it yet lists it. */
const recipeLack: Check = (value) =>
  shape({ kind: exactly("tool"), tool: exactly(...(Object.keys(CONTENT_WEIGHT_KG) as BackpackContent[])) })(value) ||
  shape({ kind: exactly("station"), station: workStation })(value) ||
  shape({ kind: exactly("materials") })(value);

/**
 * How each kind of notice must look in a save, besides the game minute it stops showing at.
 * TypeScript reports a missing kind.
 */
const NOTICES: { readonly [Kind in GameNotice]: Record<string, Check> } = {
  collapsed: {},
  survivedFirstNight: {},
  backpackFull: {},
  chestFull: {},
  holdsUpPiece: {},
  stillHoldsSomething: {},
  saveBroken: {},
  putLogDownFirst: {},
  noLogBesideStation: { station: workStation },
  cannotCraftYet: { lacks: list(recipeLack) },
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
  stepCount: count,
  firstNightOver: boolean,
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
