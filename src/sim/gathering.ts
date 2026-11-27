import type { Refusal } from "./api-refusal";
import { addToBackpack, fitsInBackpack, hasInBackpack, type Backpack } from "./backpack";
import type { ApproachReach } from "./approach";
import { setComponent, type Entity, type EntityStore } from "./entities";
import { playerEntities } from "./entity-queries";
import { goneRefusal, shoulderRefusal, toolRefusal } from "./refusals";
import type { HandReach } from "./hand-reach";
import { groundDistance, type GroundPoint } from "./ground-point";
import type { CommandRules, RuleGame } from "./command-rule";
import type { Carrying } from "./carrying";

/** The player can pick up a stick from this far away, in metres. */
const PICK_UP_REACH_METRES = 2;

/** How long the player takes to split a log into firewood, in seconds. */
export const SPLIT_SECONDS = 3;

/** How far the player is through splitting the log on their shoulder, from 0 to 1, or undefined if they are not splitting now. */
export function splittingNow(player: Entity): { progress: number } | undefined {
  if (player.splitTask === undefined) return undefined;
  return { progress: Math.min(1, player.splitTask.secondsDone / SPLIT_SECONDS) };
}
/** How many pieces of firewood one log splits into. */
export const FIREWOOD_PER_LOG = 4;

export interface Gathering {
  /**
   * Where the player walks to pick up a stick or piece of bark on the ground: onto it, or beside it if something blocks its spot.
   * Undefined if the entity is not that material on the ground.
   */
  reach(id: number, material: GroundMaterial): ApproachReach | undefined;
  /**
   * Has the player reach down for a stick or piece of bark within reach, to put it in the backpack. The approach runs it once
   * they arrive. If the backpack has no room for it when the hand gets to it, it stays on the ground and the reach gives "backpackFull".
   */
  pickUp(id: number, material: GroundMaterial): void;
  /** Starts the player splitting the log on their shoulder into firewood with the axe. The game calls it only once `splitRefusal` passes. */
  splitLog(): void;
  /**
   * Why the player could not split a log now: without the axe, or without room in the backpack for all the firewood.
   * For the log on their shoulder, `logId` is undefined, and they must carry a log. For a log on the ground, given by `logId`,
   * it must not be gone, and they must carry no log, since splitting picks it up first.
   */
  splitRefusal(logId: number | undefined): Refusal | undefined;
  /** Stops the player splitting a log. */
  cancel(): void;
  /** Moves splitting on by one logic step. */
  step(stepSeconds: number): undefined;
}

/** A material that lies on the ground as its own entity, and that the player picks up into the backpack. */
export type GroundMaterial = "stick" | "bark";

/** Lets the player gather fuel into the backpack: sticks and bark from the ground, and firewood split from logs. */
export function createGathering(entities: EntityStore, hand: Pick<HandReach, "start">): Gathering {
  const players = playerEntities(entities);
  const splitters = entities.with("splitTask", "backpack");

  /** The stick or piece of bark with this id, if it still lies within the gatherer's reach. */
  function lyingInReach(gatherer: { position: GroundPoint }, id: number, material: GroundMaterial): (Entity & { position: GroundPoint }) | undefined {
    const lying = entities.entity(id);
    if (lying?.[material] !== true || lying.position === undefined) return undefined;
    if (groundDistance(lying.position, gatherer.position) > PICK_UP_REACH_METRES) return undefined;
    return lying as Entity & { position: GroundPoint };
  }

  /**
   * Has the gatherer reach down for a stick or piece of bark they have walked to. When the hand gets to it, it goes in
   * the backpack if it still lies there and fits. If it does not fit, it stays on the ground and the reach refuses.
   */
  function reachFor(gatherer: { position: GroundPoint }, backpack: Backpack, id: number, material: GroundMaterial): void {
    const lying = lyingInReach(gatherer, id, material);
    if (lying === undefined) return;
    hand.start("low", lying.position, () => {
      const still = lyingInReach(gatherer, id, material);
      if (still === undefined) return undefined;
      if (!addToBackpack(backpack, material, 1)) return "backpackFull";
      entities.remove(still);
      return undefined;
    });
  }

  /** Why the player could not split the log on their shoulder: they carry none. */
  function carriedLogRefusal(player: Entity | undefined): Refusal | undefined {
    return player?.carrying === "log" ? undefined : { kind: "noLogCarried" };
  }

  /** Why the player could not pick up a log on the ground to split it: it is gone, or a log is already on their shoulder. */
  function groundLogRefusal(player: Entity | undefined, logId: number): Refusal | undefined {
    return goneRefusal(entities, logId) ?? shoulderRefusal(player);
  }

  return {
    reach(id, material) {
      const lying = entities.entity(id);
      if (lying?.[material] !== true || lying.position === undefined) return undefined;
      return { target: lying.position, metres: PICK_UP_REACH_METRES, walk: { style: "onto", spot: lying.position } };
    },
    pickUp(id, material) {
      for (const player of players) {
        const { backpack } = player;
        if (backpack !== undefined) reachFor(player, backpack, id, material);
      }
    },
    splitLog() {
      for (const player of players) {
        entities.removeComponent(player, "walkPath");
        setComponent(entities, player, "splitTask", { secondsDone: 0 });
      }
    },
    splitRefusal(logId) {
      const player = players.first;
      const refusal = toolRefusal(player, "axe") ?? (logId === undefined ? carriedLogRefusal(player) : groundLogRefusal(player, logId));
      if (refusal !== undefined) return refusal;
      return player?.backpack === undefined || fitsInBackpack(player.backpack, "firewood", FIREWOOD_PER_LOG) ? undefined : { kind: "backpackFull" };
    },
    cancel() {
      for (const player of players) entities.removeComponent(player, "splitTask");
    },
    step(stepSeconds) {
      // Copy each list first, because players who finish or give up leave the query while it is being walked.
      for (const splitter of [...splitters]) {
        if (splitter.carrying !== "log" || !canSplitInto(splitter.backpack)) {
          entities.removeComponent(splitter, "splitTask");
          continue;
        }
        splitter.splitTask.secondsDone += stepSeconds;
        if (splitter.splitTask.secondsDone < SPLIT_SECONDS) continue;
        entities.removeComponent(splitter, "splitTask");
        if (addToBackpack(splitter.backpack, "firewood", FIREWOOD_PER_LOG)) entities.removeComponent(splitter, "carrying");
      }
    },
  };
}

/** True if the backpack has the axe and room for all the firewood from one log. */
function canSplitInto(backpack: Backpack): boolean {
  return hasInBackpack(backpack, "axe") && fitsInBackpack(backpack, "firewood", FIREWOOD_PER_LOG);
}

/** The rules for picking up sticks and bark, and for splitting a log into firewood. */
export function gatheringRules(
  gathering: Gathering,
  carrying: Carrying,
  { entities, startApproach, stopOtherWork }: RuleGame,
): CommandRules<"pickUpStick" | "pickUpBark" | "splitLog"> {
  return {
    pickUpStick: {
      start: "fresh",
      needsFreeHands: true,
      refusal: (command) => goneRefusal(entities, command.stickId),
      approach: {
        reach: (command) => gathering.reach(command.stickId, "stick"),
        act: (command) => {
          gathering.pickUp(command.stickId, "stick");
        },
      },
    },
    pickUpBark: {
      start: "fresh",
      needsFreeHands: true,
      refusal: (command) => goneRefusal(entities, command.barkId),
      approach: {
        reach: (command) => gathering.reach(command.barkId, "bark"),
        act: (command) => {
          gathering.pickUp(command.barkId, "bark");
        },
      },
    },
    splitLog: {
      // A log given by id must lie on the ground, and only then does the player stop what they were doing. A debarked log cannot be split.
      start: "alongside",
      needsFreeHands: true,
      refusal: (command) => gathering.splitRefusal(command.logId),
      run: (command) => {
        if (command.logId !== undefined) return startApproach(command);
        stopOtherWork();
        gathering.splitLog();
        return undefined;
      },
      // A log given by id is picked up first, then split on the player's shoulder.
      approach: {
        reach: ({ logId }) => (logId === undefined || entities.entity(logId)?.log === undefined ? undefined : carrying.pickUpReach(logId)),
        act: ({ logId }) => {
          if (logId !== undefined) carrying.pickUp(logId, true);
        },
      },
    },
  };
}
