// Checks that stored data has the shape of a save, so a broken save is turned away before the game loads it.
import type { GameNotice } from "./api";
import { CONTENT_WEIGHT_KG } from "./backpack";
import type { Entity } from "./entities";
import { NEED_KINDS } from "./needs";
import { STRUCTURES } from "./structures";

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
  backpack: shape({ contents: backpackContents }),
  chopTask: shape({ treeId: count, secondsDone: finite }),
  logPickUpTask: shape({ logId: count }),
  stump: exactly(true),
  log: shape({ heading: finite }),
  debarkedLog: shape({ heading: finite }),
  debarkTask: shape({ logId: count, secondsDone: finite }),
  carrying: exactly("log", "debarkedLog"),
  stick: exactly(true),
  stickPickUpTask: shape({ stickId: count }),
  splitTask: shape({ secondsDone: finite }),
  blueprint: shape({ piece: exactly(...STRUCTURES.map(({ kind }) => kind)), progress: finite, materialsSpent: count }),
  facing: shape({ turns: exactly(0, 1, 2, 3) }),
  buildTask: shape({ blueprintId: count }),
  campfire: shape({ lit: boolean, fuelMinutes: finite }),
  leanTo: exactly(true),
  roof: shape({ min: point, max: point }),
  forageSpot: shape({ food: exactly("berries", "mushroom") }),
  regrowing: shape({ minutesLeft: finite }),
  forageTask: shape({ spotId: count }),
  bedroll: exactly(true),
  bedrollTask: shape({ bedrollId: count, then: exactly("pickUp", "sleep") }),
  needs: shape(Object.fromEntries(NEED_KINDS.map((kind) => [kind, shape({ level: finite, minutesWithout: finite })]))),
  respawnPoint: point,
  drinkTask: point,
  sickness: shape({ minutesLeft: finite }),
  fillPotTask: point,
  potOnFire: shape({ water: exactly("river", "boiled"), minutesBoiling: finite }),
  rain: shape({ falling: boolean, changeAtMinutes: finite, changes: count }),
};

const components: Check = shape(COMPONENT_CHECKS, Object.keys(COMPONENT_CHECKS));

/** Every kind of notice. TypeScript reports a missing one. */
const NOTICES: { readonly [Kind in GameNotice]: true } = { collapsed: true, survivedFirstNight: true, backpackFull: true, saveBroken: true };

/** The components the player always has. */
const PLAYER_COMPONENTS = ["position", "previousPosition", "backpack", "needs", "respawnPoint"] as const;

const saveShape = shape({
  version: count,
  seed: (value) => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) < 2 ** 32,
  clockMinutes: (value) => finite(value) && (value as number) >= 0,
  stepCount: count,
  firstNightOver: boolean,
  notice: (value) => value === null || shape({ kind: exactly(...Object.keys(NOTICES)), untilMinutes: finite })(value),
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
