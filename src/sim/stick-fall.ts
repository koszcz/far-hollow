// New sticks fall from the standing trees as time passes, so the forest floor never runs out of sticks.
// Most fall as a deadfall, some fall alone. The ground never holds more sticks than a new valley starts with.
// Sticks fall where the ground is short of the sticks it started with, so an area the player cleared fills up again.
import { distanceOutside } from "./building";
import { layDeadfall, rollDeadfallSize, spotUnderTree, type SpotIsOpen } from "./deadfall";
import { bedrollEntities, pileEntities, stickEntities, stickFallEntities, treeEntities, type EntityStore } from "./entities";
import { createRandom, scramble, type Random } from "./random";
import { footprintOfEntity, placedStructures } from "./structures";
import { groundDistance, stickSpotCheck, terrainHeightAt, type GroundPoint, type Valley } from "./valley";

/** When the next sticks fall. It is plain data, so it can be saved. */
export interface StickFall {
  /** Game minutes until the next sticks fall. */
  minutesToNext: number;
  /** How many times sticks have fallen so far. It picks where the next ones fall. */
  falls: number;
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
/** A bedroll or pile reaches about this far from its middle, in metres. */
const BEDROLL_OR_PILE_REACH_METRES = 1;
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

export function createStickFall(): StickFall {
  return { minutesToNext: STICK_FALL_MINUTES, falls: 0 };
}

export interface StickFalling {
  /** Moves time on by this many game minutes, laying new sticks each time a fall is due. */
  pass(gameMinutes: number): void;
}

/**
 * Lets sticks fall in this game's valley. The stick fall state lives on an entity, so it is saved with the game.
 * A game saved before sticks fell again gets a new stick fall here.
 */
export function createStickFalling(entities: EntityStore, valley: Valley): StickFalling {
  const fall = (stickFallEntities(entities).first ?? entities.add({ stickFall: createStickFall() })).stickFall;
  const inValley = stickSpotCheck(valley);
  const limit = valley.sticks.length;
  const sticks = stickEntities(entities);
  const trees = treeEntities(entities);

  const startingCounts = countByArea(valley.sticks);

  function layFall(random: Random): void {
    const room = limit - sticks.entities.length;
    if (room <= 0) return;
    const nowCounts = countByArea(sticks.entities.map((stick) => stick.position));
    const treesByArea = new Map<number, GroundPoint[]>();
    for (const { position } of trees) {
      const area = areaOf(position);
      const list = treesByArea.get(area);
      if (list) list.push(position);
      else treesByArea.set(area, [position]);
    }
    // Each area with standing trees is weighted by how many sticks it is short of what it started with.
    const shortAreas: { trees: GroundPoint[]; short: number }[] = [];
    for (const [area, areaTrees] of treesByArea) {
      const short = (startingCounts.get(area) ?? 0) - (nowCounts.get(area) ?? 0);
      if (short > 0) shortAreas.push({ trees: areaTrees, short });
    }
    if (shortAreas.length === 0) return;
    const isOpen = openSpotCheck(entities, inValley);
    const lone = random() < LONE_STICK_SHARE;
    const size = lone ? 1 : Math.min(room, rollDeadfallSize(random));
    for (let attempt = 0; attempt < TRIES_PER_FALL; attempt += 1) {
      const areaTrees = pickByShortfall(random, shortAreas);
      const tree = areaTrees[Math.floor(random() * areaTrees.length)];
      if (tree === undefined) continue;
      const spots = lone ? loneStick(random, tree, isOpen) : layDeadfall(random, tree, size, isOpen);
      if (spots === undefined) continue;
      for (const { x, z } of spots) entities.add({ stick: true, position: { x, y: terrainHeightAt(valley.terrain, x, z), z } });
      return;
    }
  }

  return {
    pass(gameMinutes) {
      fall.minutesToNext -= gameMinutes;
      while (fall.minutesToNext <= 0) {
        fall.falls += 1;
        fall.minutesToNext += STICK_FALL_MINUTES;
        layFall(createRandom(scramble(valley.seed + Math.imul(fall.falls, FALL_SEED_STEP))));
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
function pickByShortfall(random: Random, areas: readonly { trees: GroundPoint[]; short: number }[]): GroundPoint[] {
  const total = areas.reduce((sum, area) => sum + area.short, 0);
  let left = random() * total;
  for (const area of areas) {
    left -= area.short;
    if (left < 0) return area.trees;
  }
  return (areas[areas.length - 1] as { trees: GroundPoint[] }).trees;
}

function loneStick(random: Random, tree: GroundPoint, isOpen: SpotIsOpen): GroundPoint[] | undefined {
  const spot = spotUnderTree(random, tree);
  return isOpen(spot) ? [spot] : undefined;
}

/** A check for spots where a new stick may fall: open valley ground, and not on or next to anything the player has placed. */
function openSpotCheck(entities: EntityStore, inValley: SpotIsOpen): SpotIsOpen {
  const footprints = placedStructures(entities).map(({ entity }) => footprintOfEntity(entity));
  const points = [...bedrollEntities(entities), ...pileEntities(entities)].map((entity) => entity.position);
  return (spot) =>
    inValley(spot) &&
    footprints.every((footprint) => distanceOutside(footprint, spot) >= STICK_GAP_FROM_PLACED_METRES) &&
    points.every((point) => groundDistance(point, spot) >= STICK_GAP_FROM_PLACED_METRES + BEDROLL_OR_PILE_REACH_METRES);
}
