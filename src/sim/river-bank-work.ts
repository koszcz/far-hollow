// Timed work by hand on the river bank: gathering stone and digging clay. The player walks into reach of a spot on the river
// bank or in the river, works there for a few seconds, and puts one of the material in the backpack. Neither material runs out
// and neither needs a tool.
import type { ActionCommand, Refusal } from "./api";
import type { ApproachReach } from "./approach";
import { addToBackpack, fitsInBackpack, type Backpack, type BackpackContent } from "./backpack";
import type { CommandRule } from "./command-rule";
import { riverReach } from "./drinking";
import { playerEntities, setComponent, type Entity, type EntityStore } from "./entities";
import { createGroundMap, groundTypeAt, type GroundMap } from "./ground-types";
import type { GroundPoint } from "./ground-point";
import { distanceToRiver, type Valley } from "./valley";
import type { WalkMap } from "./walk-map";

/** The player can work river bank ground this far away, in metres. */
const RIVER_BANK_REACH_METRES = 2;

/** The ground map of each valley, made once, since every click on the ground asks for it. */
const groundMaps = new WeakMap<Valley, GroundMap>();

/** True if a spot is river bank ground or in the river: somewhere the player can gather stone and dig clay. */
export function isRiverBank(valley: Valley, spot: GroundPoint): boolean {
  let map = groundMaps.get(valley);
  if (map === undefined) {
    map = createGroundMap(valley);
    groundMaps.set(valley, map);
  }
  return groundTypeAt(map, spot) === "riverBank";
}

/** One kind of river bank work: the task part that marks it on the player, what it yields, and how long one takes, in seconds. */
export interface RiverBankWorkKind {
  readonly task: "stoneTask" | "clayTask";
  readonly content: BackpackContent;
  readonly seconds: number;
}

/** How far the player is through one piece of this work, from 0 to 1, or undefined if they are not doing it now. */
export function riverBankWorkNow(player: Entity, kind: RiverBankWorkKind): { progress: number } | undefined {
  const task = player[kind.task];
  if (task === undefined) return undefined;
  return { progress: Math.min(1, task.secondsDone / kind.seconds) };
}

export interface RiverBankWork {
  /**
   * Where the approach takes the player to work a spot: onto river bank ground, or within reach of it,
   * or to the bank nearest a spot in the river. Undefined if the spot is not on the river bank.
   */
  reach(spot: GroundPoint): ApproachReach | undefined;
  /**
   * Starts the player working a spot on the river bank or in the river within reach. The approach runs it once they arrive.
   * Does nothing if the spot is not on the river bank. The game calls it only once `refusal` passes.
   */
  start(spot: GroundPoint): void;
  /** Why the player could not do this work now: one more of the material does not fit in the backpack. */
  refusal(): Refusal | undefined;
  /** Stops the player doing this work. */
  cancel(): void;
  /** Moves the work on by one logic step. */
  step(stepSeconds: number): undefined;
}

/** Lets the player do one kind of river bank work, putting what it yields in the backpack. */
export function createRiverBankWork(entities: EntityStore, walkMap: WalkMap, valley: Valley, kind: RiverBankWorkKind): RiverBankWork {
  const players = playerEntities(entities);
  const workers = entities.with(kind.task, "position", "backpack");

  function inRiver(spot: GroundPoint): boolean {
    return distanceToRiver(valley.river, spot) <= valley.river.width / 2;
  }

  function fits(backpack: Backpack): boolean {
    return fitsInBackpack(backpack, kind.content, 1);
  }

  return {
    reach(spot) {
      const player = players.first;
      if (!isRiverBank(valley, spot) || player === undefined) return undefined;
      // A spot in the river is reached from its bank. That reach also covers every spot in the river within RIVER_BANK_REACH_METRES.
      if (inRiver(spot)) return riverReach(valley, walkMap, player.position, spot);
      return { target: { x: spot.x, z: spot.z }, metres: RIVER_BANK_REACH_METRES, walk: { style: "onto", spot: { x: spot.x, z: spot.z } } };
    },
    start(spot) {
      if (!isRiverBank(valley, spot)) return;
      for (const player of players) {
        if (player.backpack === undefined) continue;
        setComponent(entities, player, kind.task, { x: spot.x, z: spot.z, secondsDone: 0 });
      }
    },
    refusal() {
      const backpack = players.first?.backpack;
      return backpack === undefined || fits(backpack) ? undefined : { kind: "backpackFull" };
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, kind.task);
    },
    step(stepSeconds) {
      // Copy the list first, because players who finish or give up leave the query while it is being walked.
      for (const worker of [...workers]) {
        const task = worker[kind.task];
        if (!fits(worker.backpack)) {
          entities.removeComponent(worker, kind.task);
          continue;
        }
        task.secondsDone += stepSeconds;
        if (task.secondsDone < kind.seconds) continue;
        entities.removeComponent(worker, kind.task);
        addToBackpack(worker.backpack, kind.content, 1);
      }
      return undefined;
    },
  };
}

/** A command to do river bank work at a spot. */
type RiverBankCommand = Extract<ActionCommand, { type: "gatherStone" | "digClay" }>;

/** The rule for a command to do one kind of river bank work at a spot. The player walks into reach first, with free hands. */
export function riverBankWorkRule(work: RiverBankWork): CommandRule<RiverBankCommand> {
  return {
    start: "fresh",
    needsFreeHands: true,
    refusal: () => work.refusal(),
    approach: {
      reach: (command) => work.reach(command),
      act: (command) => {
        work.start({ x: command.x, z: command.z });
        return undefined;
      },
    },
  };
}
