import { describe, expect, it } from "bun:test";
import { ACTION_QUEUE_LIMIT, queued, type ActionCommand } from "./api-commands";
import { type Notice, type PlainNotice } from "./api-notice";
import { type Refusal } from "./api-refusal";
import { createActionQueue, type ActionQueue, type QueueRule } from "./action-queue";

describe("the action queue on its own", () => {
  it(`holds at most ${ACTION_QUEUE_LIMIT} actions and says why it turns more away`, () => {
    const world = fakeWorld();
    const walks = [1, 2, 3, 4, 5].map(walkTo);

    for (const walk of walks) world.queue.receive(queued(walk));

    expect(world.queue.actions()).toEqual(walks.slice(0, ACTION_QUEUE_LIMIT));
    expect(world.carriedOut).toEqual([walkTo(1)]);
    expect(world.notices).toEqual(["queueFull"]);
  });

  it("drops an action refused when its turn comes, says why, and starts the one after", () => {
    const world = fakeWorld();
    const first = walkTo(1);
    const refused = walkTo(2);
    const last = walkTo(3);
    world.queue.receive(queued(first));
    world.queue.receive(queued(refused));
    world.queue.receive(queued(last));

    world.refused.set(2, { kind: "fireEmpty" });
    world.busy = false;
    world.queue.moveOn();

    expect(world.queue.actions()).toEqual([last]);
    expect(world.carriedOut).toEqual([first, last]);
    expect(world.notices).toEqual([{ kind: "actionSkipped", refusal: { kind: "fireEmpty" } }]);
  });

  it("keeps an action with no end going until another action waits and its rule says it may stop", () => {
    const world = fakeWorld();
    const endless = walkTo(1);
    const next = walkTo(2);
    world.rules.set(1, { canStopForNext: () => world.mayStop });
    world.queue.receive(queued(endless));

    world.mayStop = true;
    world.queue.moveOn();
    expect(world.queue.actions()).toEqual([endless]);

    world.mayStop = false;
    world.queue.receive(queued(next));
    world.queue.moveOn();
    expect(world.queue.actions()).toEqual([endless, next]);

    world.mayStop = true;
    world.queue.moveOn();
    expect(world.queue.actions()).toEqual([next]);
    expect(world.stops).toBe(1);
    expect(world.carriedOut).toEqual([endless, next]);
  });

  it("never stops a busy action whose rule has no stop check", () => {
    const world = fakeWorld();
    world.queue.receive(queued(walkTo(1)));
    world.queue.receive(queued(walkTo(2)));

    world.queue.moveOn();

    expect(world.queue.actions()).toEqual([walkTo(1), walkTo(2)]);
    expect(world.stops).toBe(0);
  });

  it("makes a command sent on its own the action under way when it stops what the player was doing", () => {
    const world = fakeWorld();
    world.queue.receive(queued(walkTo(1)));
    world.queue.receive(queued(walkTo(2)));
    world.rules.set(3, { queue: "apart" });
    world.stopsWork.add(3);

    world.queue.receive(walkTo(3));

    expect(world.queue.actions()).toEqual([walkTo(3)]);
  });
});

/** A walk to a spot on a line: a plain action command, told apart by `x`. */
function walkTo(x: number): ActionCommand {
  return { type: "walkTo", x, z: 0 };
}

/** A stand-in for the game: each command is a walk, keyed by its `x`. The player stays busy until a test says otherwise. */
function fakeWorld() {
  const world = {
    busy: true,
    mayStop: false,
    stops: 0,
    carriedOut: [] as ActionCommand[],
    notices: [] as (Notice | PlainNotice)[],
    refused: new Map<number, Refusal>(),
    rules: new Map<number, QueueRule>(),
    stopsWork: new Set<number>(),
    queue: undefined as unknown as ActionQueue,
  };
  const key = (command: ActionCommand): number => (command.type === "walkTo" ? command.x : 0);
  world.queue = createActionQueue({
    rule: (command) => world.rules.get(key(command)) ?? {},
    refusal: (command) => world.refused.get(key(command)) ?? null,
    carryOut: (command) => {
      world.carriedOut.push(command);
      world.busy = true;
      return world.stopsWork.has(key(command));
    },
    playerIsBusy: () => world.busy,
    stopUnderWay: () => {
      world.stops += 1;
      world.busy = false;
    },
    showNotice: (notice) => {
      world.notices.push(notice);
    },
  });
  return world;
}
