// New sticks fall from the standing trees as time passes, so the forest floor never runs out of sticks.
// Most fall as a deadfall, some fall alone. The ground never holds more sticks than a new valley starts with.
// Sticks fall where the ground is short of the sticks it started with, so an area the player cleared fills up again.
import { distanceOutside } from "./building";
import { DEADFALL_MIN_STICKS, layDeadfall, layLoneStick, rollDeadfallSize, type SpotIsOpen } from "./deadfall";
import {
  barkEntities,
  bedrollEntities,
  debarkedLogEntities,
  logEntities,
  pileEntities,
  stickEntities,
  stickFallEntities,
  treeEntities,
  type EntityStore,
} from "./entities";
import { createRandom, scramble, type Random } from "./random";
import { footprintOfEntity, placedStructures } from "./structures";
import { groundDistance, stickSpotCheck, terrainHeightAt, type GroundPoint, type Valley } from "./valley";

/** The saved state of the stick fall: when the next sticks fall. It is plain data, so it can be saved. */
export interface StickFallState {
  /** Game minutes until the next sticks fall. */
  minutesToNext: number;
  /** How many times sticks have tried to fall so far. It picks where the next ones fall. */
  falls: number;
  /** Falls that found no room and are still owed. They are tried again each time a fall is due. */
  owed: number;
}

/**
 * Sticks fall this often, in game minutes. Each fall lays about 4 sticks, so about 100 sticks fall in a game day.
 * That is about as fast as a player gathers sticks while working round camp.
 */
export const STICK_FALL_MINUTES = 60;
/** This share of falls is one stick alone. The rest are deadfalls of 3 to 6 sticks. */
const LONE_STICK_SHARE = 0.25;
/** No stick falls within this distance of anything the player has built or placed, in metres. */
export const STICK_GAP_FROM_PLACED_METRES = 1.5;
/** A bedroll, pile, log, debarked log, or piece of bark reaches at most about this far from its middle, in metres. */
const LOOSE_THING_REACH_METRES = 1;
/**
 * The valley floor is split into square areas this wide, in metres. Sticks fall in an area short of the sticks it started with,
 * so a cleared area fills up again. Within that area they fall under a random standing tree.
 */
const AREA_METRES = 10;
/** Enough areas in a row to cover any valley, so each area gets its own number. */
const AREAS_PER_ROW = 1000;
/** How many trees a fall tries before it gives up, when built things or water leave no room under them. */
const TRIES_PER_FALL = 8;
/** Mixes the number of falls into the seed, so each fall gets its own random spot. */
const FALL_SEED_STEP = 0x85ebca6b;

/** At most this many falls are owed at once, a game day's worth. A fall that finds no room while this many are owed is lost. */
const MAX_OWED_FALLS = 24;

export function createStickFallState(): StickFallState {
  return { minutesToNext: STICK_FALL_MINUTES, falls: 0, owed: 0 };
}

/** The system that lets sticks fall as time passes. */
export interface StickFallSystem {
  /** Moves time on by this many game minutes, laying new sticks each time a fall is due. */
  pass(gameMinutes: number): void;
}

/** One area of the valley floor with standing trees, and how many sticks it is short of what it started with. */
interface ShortArea {
  trees: GroundPoint[];
  short: number;
}

/** What came of one fall: sticks were laid, no sticks were needed, or there was no room for them. */
type FallOutcome = "laid" | "notNeeded" | "noRoom";

/**
 * Lets sticks fall in this game's valley. The stick fall state lives on an entity, so it is saved with the game.
 * A game saved before sticks fell again gets a new stick fall here.
 */
export function createStickFallSystem(entities: EntityStore, valley: Valley): StickFallSystem {
  const fall = (stickFallEntities(entities).first ?? entities.add({ stickFall: createStickFallState() })).stickFall;
  const inValley = stickSpotCheck(valley);
  const limit = valley.sticks.length;
  const sticks = stickEntities(entities);
  const trees = treeEntities(entities);

  const startingCounts = countByArea(valley.sticks);

  function layFall(random: Random): FallOutcome {
    const room = limit - sticks.entities.length;
    if (room <= 0) return "notNeeded";
    const nowCounts = countByArea(sticks.entities.map((stick) => stick.position));
    const treesByArea = new Map<number, GroundPoint[]>();
    for (const { position } of trees) {
      const area = areaOf(position);
      const list = treesByArea.get(area);
      if (list) list.push(position);
      else treesByArea.set(area, [position]);
    }
    // Each area with standing trees is weighted by how many sticks it is short of what it started with.
    const shortAreas: ShortArea[] = [];
    for (const [area, areaTrees] of treesByArea) {
      const short = (startingCounts.get(area) ?? 0) - (nowCounts.get(area) ?? 0);
      if (short > 0) shortAreas.push({ trees: areaTrees, short });
    }
    if (shortAreas.length === 0) return "notNeeded";
    const isOpen = openSpotCheck(entities, inValley);
    // A deadfall needs at least 3 sticks. With less room than that, the fall is one stick alone.
    const lone = random() < LONE_STICK_SHARE || room < DEADFALL_MIN_STICKS;
    const size = lone ? 1 : Math.min(room, rollDeadfallSize(random));
    for (let attempt = 0; attempt < TRIES_PER_FALL; attempt += 1) {
      const areaTrees = pickByShortfall(random, shortAreas);
      const tree = areaTrees[Math.floor(random() * areaTrees.length)];
      if (tree === undefined) continue;
      const spots = lone ? layLoneStick(random, tree, isOpen) : layDeadfall(random, tree, size, isOpen);
      if (spots === undefined) continue;
      for (const { x, z } of spots) entities.add({ stick: true, position: { x, y: terrainHeightAt(valley.terrain, x, z), z } });
      return "laid";
    }
    return "noRoom";
  }

  /** Lays the owed falls one by one, until one finds no room. Each try is a new fall with its own random spot. */
  function layOwedFalls(): void {
    while (fall.owed > 0) {
      fall.falls += 1;
      const outcome = layFall(createRandom(scramble(valley.seed + Math.imul(fall.falls, FALL_SEED_STEP))));
      if (outcome === "noRoom") return;
      // When the ground is full, or no area is short of sticks, nothing more is owed.
      fall.owed = outcome === "notNeeded" ? 0 : fall.owed - 1;
    }
  }

  return {
    pass(gameMinutes) {
      fall.minutesToNext -= gameMinutes;
      while (fall.minutesToNext <= 0) {
        fall.minutesToNext += STICK_FALL_MINUTES;
        fall.owed = Math.min(fall.owed + 1, MAX_OWED_FALLS);
        layOwedFalls();
      }
    },
  };
}

/** Which square area of the valley floor a spot lies in, as a number. */
function areaOf({ x, z }: GroundPoint): number {
  return Math.floor(z / AREA_METRES) * AREAS_PER_ROW + Math.floor(x / AREA_METRES);
}

/** How many of these sticks lie in each area. */
function countByArea(sticks: readonly GroundPoint[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const stick of sticks) {
    const area = areaOf(stick);
    counts.set(area, (counts.get(area) ?? 0) + 1);
  }
  return counts;
}

/** Picks one area at random. An area short of more sticks is more likely to be picked. */
function pickByShortfall(random: Random, areas: readonly ShortArea[]): GroundPoint[] {
  const total = areas.reduce((sum, area) => sum + area.short, 0);
  let left = random() * total;
  for (const area of areas) {
    left -= area.short;
    if (left < 0) return area.trees;
  }
  return areas[areas.length - 1]?.trees ?? [];
}

/**
 * A check for spots where a new stick may fall: open valley ground, and not on or next to anything the player has built or placed.
 * That covers structures, bedrolls, piles, and the logs, debarked logs, and bark the player left on the ground.
 */
function openSpotCheck(entities: EntityStore, inValley: SpotIsOpen): SpotIsOpen {
  const footprints = placedStructures(entities).map(({ entity }) => footprintOfEntity(entity));
  const looseThings = [bedrollEntities, pileEntities, logEntities, debarkedLogEntities, barkEntities];
  const points = looseThings.flatMap((query) => query(entities).entities.map((entity) => entity.position));
  return (spot) =>
    inValley(spot) &&
    footprints.every((footprint) => distanceOutside(footprint, spot) >= STICK_GAP_FROM_PLACED_METRES) &&
    points.every((point) => groundDistance(point, spot) >= STICK_GAP_FROM_PLACED_METRES + LOOSE_THING_REACH_METRES);
}
