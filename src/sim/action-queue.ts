// The action queue: the action under way first, then those waiting their turn. It is not saved.
// The player adds an action to the end with a Shift-click. A plain click empties the waiting actions.
// The queue knows no activity by name. It asks the game, through the functions it is given, whether the player is busy,
// and asks the rule of the action under way whether an action with no end may stop for the next one.
import { ACTION_QUEUE_LIMIT, type ActionCommand, type Command, type Notice, type PlainNotice, type Refusal } from "./api";

/** What the action queue needs to know about one kind of command, from its command rule. */
export interface QueueRule {
  /**
   * How the command meets the action queue. Without it, the command can be queued, and sent on its own it empties the queue.
   * "plainOnly": it is never queued. Sent to the queue, it runs as if sent on its own. "apart": as "plainOnly", and sent on its own
   * it leaves the queue as it is, unless it stops what the player was doing.
   */
  readonly queue?: "plainOnly" | "apart";
  /**
   * For an action with no end: whether the player may stop it now for the next action.
   * The queue calls it only while the action is under way, the player is still busy with it, and another action waits.
   * If it returns true, the queue stops the action and starts the next one. Without it, the action goes on until the player has nothing left to do.
   */
  readonly canStopForNext?: () => boolean;
}

/** What the action queue takes from the game. */
export interface ActionQueueGame {
  /** The queue rule for a command. */
  rule(command: ActionCommand): QueueRule;
  /** Why the game would turn the command away now, or null if it would not. */
  refusal(command: ActionCommand): Refusal | null;
  /** Carries out a command, refused or not, and returns whether it stopped what the player was doing. */
  carryOut(command: ActionCommand): boolean;
  /** Whether the player has anything left to do. When they have nothing, the action under way is finished. */
  playerIsBusy(): boolean;
  /** Stops what the player is doing for the action under way, as if they had stopped of their own accord. */
  stopUnderWay(): void;
  showNotice(notice: Notice | PlainNotice): void;
}

export interface ActionQueue {
  /** Takes a command the UI sent: it adds an action to the action queue, takes one out, or carries out a command on its own. */
  receive(command: Command): void;
  /**
   * Moves the action queue on, once a logic step has run. When the player has nothing left to do for the action under way,
   * it leaves the queue and the next one starts. An action the game refuses when its turn comes is dropped, with a notice saying why.
   */
  moveOn(): void;
  /** Empties the action queue without stopping anything, as when the player collapses. */
  empty(): void;
  /** The actions in the queue, the one under way first. */
  actions(): readonly ActionCommand[];
}

export function createActionQueue(game: ActionQueueGame): ActionQueue {
  /** The action queue: the action under way first, then those waiting their turn. */
  const queue: ActionCommand[] = [];

  /**
   * Carries out a command sent on its own, as a plain click does. An action empties the actions waiting in the queue.
   * If it stops what the player was doing, or starts something while the queue is empty, it becomes the action under way.
   * A command apart from the queue, such as pausing, leaves the queue as it is, unless it stops what the player was doing.
   */
  function sendOnItsOwn(command: ActionCommand): void {
    const apart = game.rule(command).queue === "apart";
    if (!apart) queue.splice(1);
    const stopped = game.carryOut(command);
    if (stopped || (!apart && queue.length === 0 && game.playerIsBusy())) queue.splice(0, queue.length, command);
  }

  /**
   * Adds an action to the end of the action queue, as a Shift-click does. With an empty queue, it starts at once.
   * It is turned away, with a notice saying why, when the queue is full or the game refuses the action now.
   */
  function queueAction(command: ActionCommand): void {
    if (game.rule(command).queue !== undefined) {
      sendOnItsOwn(command);
      return;
    }
    if (queue.length >= ACTION_QUEUE_LIMIT) {
      game.showNotice("queueFull");
      return;
    }
    const refusal = game.refusal(command);
    if (refusal !== null) {
      game.showNotice({ kind: "cannotQueue", refusal });
      return;
    }
    queue.push(command);
    if (queue.length === 1) game.carryOut(command);
  }

  /**
   * Takes the action at `index` out of the action queue, as a click on its icon does. Cancelling the action under way
   * stops what the player is doing for it, as if they had stopped of their own accord, and the next action starts.
   */
  function cancelQueuedAction(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= queue.length) return;
    if (index > 0) {
      queue.splice(index, 1);
      return;
    }
    game.stopUnderWay();
    queue.shift();
    startNext();
  }

  /** Starts the first action in the queue. An action the game refuses now is dropped, with a notice saying why, and the one after is tried. */
  function startNext(): void {
    for (let next = queue[0]; next !== undefined; next = queue[0]) {
      const refusal = game.refusal(next);
      if (refusal === null) {
        game.carryOut(next);
        return;
      }
      game.showNotice({ kind: "actionSkipped", refusal });
      queue.shift();
    }
  }

  return {
    receive(command) {
      if (command.type === "queueAction") queueAction(command.action);
      else if (command.type === "cancelQueuedAction") cancelQueuedAction(command.index);
      else sendOnItsOwn(command);
    },
    moveOn() {
      const underWay = queue[0];
      if (underWay === undefined) return;
      if (game.playerIsBusy()) {
        // An action with no end goes on while nothing waits behind it, and until its rule says it may stop.
        if (queue.length === 1 || game.rule(underWay).canStopForNext?.() !== true) return;
        game.stopUnderWay();
      }
      queue.shift();
      startNext();
    },
    empty() {
      queue.length = 0;
    },
    actions: () => queue,
  };
}
