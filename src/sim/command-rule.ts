// The shape of a command rule: how the game handles one kind of command. Each activity module exports the rules for its
// own commands, and game.ts collects them. This file imports no activity module and not game.ts, so any module can use it.
import type { QueueRule } from "./action-queue";
import type { ActionCommand, Notice, PlainNotice, Refusal } from "./api";
import type { ApproachReach } from "./approach";
import type { Entity, EntityStore } from "./entities";
import type { HandReach } from "./hand-reach";

/**
 * How the game handles one kind of command. Each kind has one rule, which commandRules in game.ts collects.
 * - `start`: "fresh" stops whatever the player was doing before the command runs. "alongside" leaves it going,
 *   so a command that sometimes starts afresh, such as placing a blueprint to build at once, stops it itself.
 * - `refusal`: why the game would turn the command away, wherever the player stands. The UI shows it before the player sends the command.
 *   The game checks it before it runs the command, and a refused command shows the refusal as a notice and does nothing.
 * - `run`: carries the command out. It only receives commands whose refusal passed. It returns a notice to show,
 *   if the work turns out not to be possible, such as a full backpack.
 * - `approach`: for a command the player walks within reach to carry out. `reach` says where the approach takes them, and
 *   `act` carries the command out once they stand there. The game checks the refusal again just before `act`. A rule with an
 *   approach and no `run` starts the approach when it runs. See approach.ts.
 * - `needsFreeHands`: the player cannot do it while they drag a sled, such as shouldering a log, gathering, chopping, building, crafting, or fishing.
 * - `keepsPlayerSitting`: a player sitting on a stool stays sitting, as for pausing or skipping time. Every other command is the player walking or acting, so they stand up.
 * - `keepsHandReach`: a reach in progress goes on, as for pausing or hiding the journal. Every other command cancels it.
 * - `queue` and `canStopForNext`: how the command meets the action queue. See QueueRule in action-queue.ts.
 */
export type CommandRule<C extends ActionCommand> = CommandRuleParts<C> &
  (
    | { readonly run: (command: C) => Notice | PlainNotice | undefined; readonly approach?: ApproachRule<C> }
    | { readonly run?: undefined; readonly approach: ApproachRule<C> }
  );

/** How a command the player walks within reach to carry out meets the approach. */
export interface ApproachRule<C extends ActionCommand> {
  readonly reach: (command: C) => ApproachReach | undefined;
  readonly act: (command: C) => Notice | PlainNotice | undefined;
}

interface CommandRuleParts<C extends ActionCommand> extends QueueRule {
  readonly start: "fresh" | "alongside";
  readonly refusal?: (command: C) => Refusal | undefined;
  readonly needsFreeHands?: true | ((command: C) => boolean);
  readonly keepsPlayerSitting?: true;
  readonly keepsHandReach?: true;
}

/** The rule for each of these kinds of command. Without a type argument, the rule for every kind. */
export type CommandRules<Type extends ActionCommand["type"] = ActionCommand["type"]> = {
  readonly [T in Type]: CommandRule<Extract<ActionCommand, { type: T }>>;
};

/** What every command rule may use from the game: the player, their hand reach, and the steps that every command shares. */
export interface RuleGame {
  readonly entities: EntityStore;
  readonly player: Entity & Required<Pick<Entity, "backpack">>;
  readonly hand: Pick<HandReach, "start">;
  /** Carries a command out now if the player stands within its reach, or else starts the approach for it. See approach.ts. */
  readonly startApproach: (command: ActionCommand) => Notice | PlainNotice | undefined;
  /** Stops whatever the player was doing, for a command that starts afresh only some of the time. */
  readonly stopOtherWork: () => void;
}
