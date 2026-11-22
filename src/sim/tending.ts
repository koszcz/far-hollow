// Tending a campfire, woodpile, or sled: work the player stands beside the thing to do, then reaches to carry out.
// The module whose thing it is gives each tend command's reach and act step. This module says how high the player
// reaches for each command, and where the hand reaches to.
import type { PlainNotice } from "./api";
import type { ApproachReach } from "./approach";
import type { ApproachRule, RuleGame } from "./command-rule";
import type { ReachHeight, TendTask } from "./entities";

/**
 * How the player reaches to carry out each campfire, woodpile, or sled command: to the ground at a campfire, at waist
 * height at a woodpile or sled. Lighting a fire and taking a sled's ropes need motions of their own, so they have none.
 */
const TEND_REACH: Readonly<Record<TendTask["type"], ReachHeight | undefined>> = {
  addFuel: "low",
  lightCampfire: undefined,
  putPotOnFire: "low",
  takePotOffFire: "low",
  cookFish: "low",
  takeFishOff: "low",
  fireJug: "low",
  takeJugOff: "low",
  stackOnWoodpile: "waist",
  takeFromWoodpile: "waist",
  loadSled: "waist",
  takeFromSled: "waist",
  loadPlanksOnSled: "waist",
  takePlanksFromSled: "waist",
  tipOutSled: "waist",
  dragSled: undefined,
};

/** The id of the campfire, woodpile, or sled a tend command works on. */
function tendedId(command: TendTask): number {
  return "campfireId" in command ? command.campfireId : "woodpileId" in command ? command.woodpileId : command.sledId;
}

/**
 * The approach for a command on a campfire, woodpile, or sled. `reach` says where the player walks to tend it. A player within
 * reach carries it out at once, without stopping other work. Otherwise they stop what they were doing, walk beside it, and
 * carry the command out there. They reach toward the thing, and `tend` carries the command out when the hand gets there.
 * A command with no reach of its own, such as lighting a fire, is carried out at once. `tend` returns a notice if it is refused.
 */
export function tendApproach<C extends TendTask>(
  { entities, hand }: Pick<RuleGame, "entities" | "hand">,
  reach: (command: NoInfer<C>) => ApproachReach | undefined,
  tend: (command: NoInfer<C>) => PlainNotice | undefined,
): ApproachRule<C> {
  return {
    reach,
    act: (command) => {
      const height = TEND_REACH[command.type];
      if (height === undefined) return tend(command);
      hand.start(height, entities.entity(tendedId(command))?.position, () => tend(command));
      return undefined;
    },
  };
}
