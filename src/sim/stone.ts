// Gathering stone on the river bank. The player walks into reach of a spot on the river bank or in the river,
// works there for a few seconds, and puts one stone in the backpack. Stone never runs out and needs no tool.
import type { Refusal } from "./api";
import type { ApproachReach } from "./approach";
import { addToBackpack, fitsInBackpack, type Backpack } from "./backpack";
import { riverReach } from "./drinking";
import { playerEntities, setComponent, type Entity, type EntityStore } from "./entities";
import { createGroundMap, groundTypeAt, type GroundMap } from "./ground-types";
import type { GroundPoint } from "./ground-point";
import { distanceToRiver, type Valley } from "./valley";
import type { WalkMap } from "./walk-map";

/** How long the player works to gather one stone, in seconds. */
export const GATHER_STONE_SECONDS = 4;

/** The player can gather stone from river bank ground this far away, in metres. */
const GATHER_STONE_REACH_METRES = 2;

/** The ground map of each valley, made once, since every click on the ground asks for it. */
const groundMaps = new WeakMap<Valley, GroundMap>();

/** True if a spot is river bank ground or in the river: somewhere the player can gather stone. */
export function isRiverBank(valley: Valley, spot: GroundPoint): boolean {
  let map = groundMaps.get(valley);
  if (map === undefined) {
    map = createGroundMap(valley);
    groundMaps.set(valley, map);
  }
  return groundTypeAt(map, spot) === "riverBank";
}

/** How far the player is through gathering one stone, from 0 to 1, or undefined if they are not gathering now. */
export function gatheringStoneNow(player: Entity): { progress: number } | undefined {
  if (player.stoneTask === undefined) return undefined;
  return { progress: Math.min(1, player.stoneTask.secondsDone / GATHER_STONE_SECONDS) };
}

export interface StoneGathering {
  /**
   * Where the approach takes the player to gather stone at a spot: onto river bank ground, or within reach of it,
   * or to the bank nearest a spot in the river. Undefined if the spot is not on the river bank.
   */
  reach(spot: GroundPoint): ApproachReach | undefined;
  /**
   * Starts the player gathering one stone at a spot on the river bank or in the river within reach. The approach runs it once they arrive.
   * Does nothing if the spot is not on the river bank. The game calls it only once `refusal` passes.
   */
  gather(spot: GroundPoint): void;
  /** Why the player could not gather stone now: one more stone does not fit in the backpack. */
  refusal(): Refusal | undefined;
  /** Stops the player gathering stone. */
  cancel(): void;
  /** Moves gathering on by one logic step. */
  step(stepSeconds: number): undefined;
}

/** Lets the player gather stone on the river bank into the backpack. */
export function createStoneGathering(entities: EntityStore, walkMap: WalkMap, valley: Valley): StoneGathering {
  const players = playerEntities(entities);
  const gatherers = entities.with("stoneTask", "position", "backpack");

  function inRiver(spot: GroundPoint): boolean {
    return distanceToRiver(valley.river, spot) <= valley.river.width / 2;
  }

  return {
    reach(spot) {
      const player = players.first;
      if (!isRiverBank(valley, spot) || player === undefined) return undefined;
      // A spot in the river is reached from its bank. That reach also covers every spot in the river within GATHER_STONE_REACH_METRES.
      if (inRiver(spot)) return riverReach(valley, walkMap, player.position, spot);
      return { target: { x: spot.x, z: spot.z }, metres: GATHER_STONE_REACH_METRES, walk: { style: "onto", spot: { x: spot.x, z: spot.z } } };
    },
    gather(spot) {
      if (!isRiverBank(valley, spot)) return;
      for (const player of players) {
        if (player.backpack === undefined) continue;
        setComponent(entities, player, "stoneTask", { x: spot.x, z: spot.z, secondsDone: 0 });
      }
    },
    refusal() {
      const backpack = players.first?.backpack;
      return backpack === undefined || stoneFits(backpack) ? undefined : { kind: "backpackFull" };
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, "stoneTask");
    },
    step(stepSeconds) {
      // Copy the list first, because players who finish or give up leave the query while it is being walked.
      for (const gatherer of [...gatherers]) {
        const task = gatherer.stoneTask;
        if (!stoneFits(gatherer.backpack)) {
          entities.removeComponent(gatherer, "stoneTask");
          continue;
        }
        task.secondsDone += stepSeconds;
        if (task.secondsDone < GATHER_STONE_SECONDS) continue;
        entities.removeComponent(gatherer, "stoneTask");
        addToBackpack(gatherer.backpack, "stone", 1);
      }
      return undefined;
    },
  };
}

function stoneFits(backpack: Backpack): boolean {
  return fitsInBackpack(backpack, "stone", 1);
}
