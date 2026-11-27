// Going to sleep in a bed: where the player walks to reach it, and handing it over to sleep in once they stand beside it.
import type { ApproachReach } from "./approach";
import { entityWith, playerEntities, type Entity, type EntityStore } from "./entities";
import { BED_WIDTH_METRES } from "./furniture/bed";
import { addGroundPoints, groundDistance, subtractGroundPoints, type GroundPoint } from "./ground-point";
import { findPath } from "./pathfinding";
import { turnOffset, wrapQuarterTurns } from "./quarter-turns";
import { footprintOfEntity } from "./structure-queries";
import { isWalkable, type WalkMap } from "./walk-map";
import type { CommandRules, RuleGame } from "./command-rule";
import { goneRefusal } from "./refusals";
import { isBehindWall, wallsIn, type Walls } from "./wall-reach";

/** The player can lie down in a bed from this far outside its edges, in metres. */
export const BED_REACH_METRES = 1;

/**
 * How far past a bed's long side the player may stand to step up into it, in metres, nearest first.
 * The bed blocks every walk-map square it reaches over, so the nearest open ground lies up to one square past its side.
 */
const BEDSIDE_METRES = [0.4, 0.7, 1] as const;
/** How far from the bed's middle, along its length, the player stands beside it, at most, in metres. */
const BEDSIDE_ALONG_METRES = 0.5;

/**
 * Where the player stands to step up into a bed, coming from `from`: off one of its long sides, on open ground, as near the
 * bed as the walk map allows. They step up from the side, never over the headboard or footboard.
 * The spot is on the bed's side of every wall in `walls`. Of the two long sides, it picks the one with the shorter walk.
 * So the player gets into a bed against a wall from the room.
 * Undefined if the player cannot walk to open ground beside either long side.
 */
export function bedsideSpot(walkMap: WalkMap, walls: Walls, bedEntity: BedEntity, from: GroundPoint): GroundPoint | undefined {
  const bed = bedEntity.position;
  const turns = bedEntity.facing?.turns ?? 0;
  const footprint = footprintOfEntity(bedEntity);
  // In the bed's own frame, its length runs along z and its width along x, as when it faces the default way.
  const own = turnOffset(subtractGroundPoints(from, bed), wrapQuarterTurns(-turns));
  const along = Math.min(BEDSIDE_ALONG_METRES, Math.max(-BEDSIDE_ALONG_METRES, own.z));
  let best: { spot: GroundPoint; metres: number } | undefined;
  for (const side of [-1, 1]) {
    const spot = BEDSIDE_METRES.map((past) => addGroundPoints(bed, turnOffset({ x: side * (BED_WIDTH_METRES / 2 + past), z: along }, turns))).find(
      (candidate) => isWalkable(walkMap, candidate) && !isBehindWall(walls, candidate, footprint),
    );
    if (spot === undefined) continue;
    const metres = walkMetres(walkMap, from, spot);
    if (metres !== undefined && (best === undefined || metres < best.metres)) best = { spot, metres };
  }
  return best?.spot;
}

/** How far the player walks from `from` to `to`, in metres, or undefined if they cannot get there. */
function walkMetres(walkMap: WalkMap, from: GroundPoint, to: GroundPoint): number | undefined {
  const path = findPath(walkMap, from, to);
  const end = path.at(-1) ?? from;
  if (groundDistance(end, to) > REACHED_METRES) return undefined;
  let metres = 0;
  let at = from;
  for (const spot of path) {
    metres += groundDistance(at, spot);
    at = spot;
  }
  return metres;
}

/** A walk that ends this close to its spot, in metres, counts as getting there. */
const REACHED_METRES = 0.01;

/** A finished bed, standing somewhere. */
export type BedEntity = Entity & Required<Pick<Entity, "furniture" | "position">>;

/** Going to sleep in beds. */
export interface Beds {
  /**
   * Where the player walks to sleep in a finished bed: beside one of its long sides, the one they come from where it is open.
   * They walk there even from within reach, so they never step up over its head or foot. With no open ground beside either
   * long side, they walk the shortest way to within reach of it. Undefined if the entity is not a finished bed.
   */
  reach(bedId: number): ApproachReach | undefined;
  /** Puts the player to sleep in a finished bed. The approach runs it once the player stands within reach. */
  sleep(bedId: number): void;
}

/** Lets the player go to sleep in a finished bed. `sleepIn` puts the player to sleep in a bed they have reached. */
export function createBeds(entities: EntityStore, walkMap: WalkMap, sleepIn: (bed: BedEntity) => void): Beds {
  const players = playerEntities(entities);
  const bedById = (bedId: number): BedEntity | undefined => {
    const bed = entityWith(entities, bedId, "furniture", "position");
    return bed?.furniture === "bed" ? bed : undefined;
  };

  return {
    reach(bedId) {
      const bed = bedById(bedId);
      if (bed === undefined) return undefined;
      const from = players.first?.position;
      const spot = from === undefined ? undefined : bedsideSpot(walkMap, wallsIn(entities), bed, from);
      return { target: footprintOfEntity(bed), metres: BED_REACH_METRES, walk: spot === undefined ? { style: "beside" } : { style: "onto", spot } };
    },
    sleep(bedId) {
      const bed = bedById(bedId);
      if (bed !== undefined) sleepIn(bed);
    },
  };
}

/** The rule for sleeping in a bed. */
export function bedRules(beds: Beds, { entities }: RuleGame): CommandRules<"sleepInBed"> {
  return {
    sleepInBed: {
      start: "fresh",
      refusal: (command) => goneRefusal(entities, command.bedId),
      approach: {
        reach: (command) => beds.reach(command.bedId),
        act: (command) => {
          beds.sleep(command.bedId);
        },
      },
    },
  };
}
