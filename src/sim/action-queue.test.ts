import { describe, expect, it } from "bun:test";
import { ACTION_QUEUE_LIMIT, queued, type ActionCommand, type Command } from "./api";
import type { Entity } from "./entities";
import { createGame, type Game } from "./game";
import type { GroundPoint } from "./ground-point";
import { distanceToRiver } from "./valley";

describe("adding actions to the action queue", () => {
  it("starts a queued action at once when the queue is empty, and lists it in the view", () => {
    const game = createGame({ seed: 42 });
    const [stick] = sticksNearPlayer(game, 1);

    send(game, queued(pickUp(game, stick)));

    expect(game.client.getView().actionQueue).toEqual([pickUp(game, stick)]);
    expect(onlyPlayer(game).approach).toBeDefined();
  });

  it("adds a queued action to the end, behind the one under way, without stopping it", () => {
    const game = createGame({ seed: 42 });
    const [first, second] = sticksNearPlayer(game, 2);

    send(game, pickUp(game, first));
    send(game, queued(pickUp(game, second)));

    expect(game.client.getView().actionQueue).toEqual([pickUp(game, first), pickUp(game, second)]);
    expect(onlyPlayer(game).approach?.command).toEqual({ type: "pickUpStick", stickId: idOf(game, first) });
  });

  it(`holds at most ${ACTION_QUEUE_LIMIT} actions, counting the one under way, and says why it turns more away`, () => {
    const game = createGame({ seed: 42 });
    const sticks = sticksNearPlayer(game, ACTION_QUEUE_LIMIT + 1);

    for (const stick of sticks) send(game, queued(pickUp(game, stick)));

    const view = game.client.getView();
    expect(view.actionQueue).toEqual(sticks.slice(0, ACTION_QUEUE_LIMIT).map((stick) => pickUp(game, stick)));
    expect(view.notice).toEqual({ kind: "queueFull" });
  });

  it("turns away an action the game refuses now, and says why", () => {
    const game = createGame({ seed: 42 });
    const [stick] = sticksNearPlayer(game, 1);
    const tree = nearestToPlayer(game, "tree");
    onlyPlayer(game).backpack.contents.axe = 0;

    send(game, pickUp(game, stick));
    send(game, queued({ type: "chopTree", treeId: idOf(game, tree) }));

    const view = game.client.getView();
    expect(view.actionQueue).toEqual([pickUp(game, stick)]);
    expect(view.notice).toEqual({ kind: "cannotQueue", refusal: { kind: "needsTool", tool: "axe" } });
  });

  it("never queues pausing or placing a blueprint: they run at once and leave the queue as it is", () => {
    const game = createGame({ seed: 42 });
    const [first, second] = sticksNearPlayer(game, 2);
    send(game, pickUp(game, first));
    send(game, queued(pickUp(game, second)));
    const player = onlyPlayer(game);

    send(game, queued({ type: "placeBlueprint", structure: "campfire", turns: 0, x: player.position.x - 4, z: player.position.z }));
    expect(game.entities.with("blueprint").size).toBe(1);
    send(game, queued({ type: "setPaused", paused: true }));
    expect(game.client.getView().paused).toBe(true);

    expect(game.client.getView().actionQueue).toEqual([pickUp(game, first), pickUp(game, second)]);
  });
});

describe("running the action queue", () => {
  it("does the actions in order, each once the one before is finished, then empties", () => {
    const game = createGame({ seed: 42 });
    const sticks = sticksNearPlayer(game, 3);
    const pickedUp: Entity[] = [];

    for (const stick of sticks) send(game, queued(pickUp(game, stick)));
    stepUntil(game, () => {
      for (const stick of sticks) if (!game.entities.has(stick) && !pickedUp.includes(stick)) pickedUp.push(stick);
      return game.client.getView().actionQueue.length === 0;
    });

    expect(pickedUp).toEqual(sticks);
    expect(game.client.getView().backpack.stick).toBe(3);
  });

  it("drops an action the game refuses when its turn comes, says why, and starts the one after", () => {
    const game = createGame({ seed: 42 });
    const [first, second] = [layLog(game, -3), layLog(game, -5)];
    const [stick] = sticksNearPlayer(game, 1);

    send(game, queued({ type: "pickUpLog", logId: idOf(game, first) }));
    // Allowed now, but refused once the first log is on the shoulder.
    send(game, queued({ type: "pickUpLog", logId: idOf(game, second) }));
    send(game, queued(pickUp(game, stick)));
    stepUntil(game, () => game.client.getView().notice !== null);

    const view = game.client.getView();
    expect(view.notice).toEqual({ kind: "actionSkipped", refusal: { kind: "shoulderFull" } });
    expect(view.carrying).toBe("log");
    expect(view.actionQueue).toEqual([pickUp(game, stick)]);
    stepUntil(game, () => !game.entities.has(stick));
    expect(game.entities.has(second)).toBe(true);
  });

  it("skips picking up a stick that is gone when its turn comes, says why, and starts the one after", () => {
    const game = createGame({ seed: 42 });
    const [stick, other] = sticksNearPlayer(game, 2);

    send(game, queued(pickUp(game, stick)));
    // Allowed now, but the stick is gone once the first action picks it up.
    send(game, queued(pickUp(game, stick)));
    send(game, queued(pickUp(game, other)));
    stepUntil(game, () => game.client.getView().notice !== null);

    const view = game.client.getView();
    expect(view.notice).toEqual({ kind: "actionSkipped", refusal: { kind: "gone" } });
    expect(view.actionQueue).toEqual([pickUp(game, other)]);
  });

  it("keeps fishing while nothing waits behind it", () => {
    const game = createGame({ seed: 42 });
    giveRod(game);
    const fish: ActionCommand = { type: "fish", ...riverSpotNearPlayer(game) };

    send(game, queued(fish));
    stepUntil(game, () => game.client.getView().action?.kind === "fish");
    runSteps(game, 300);

    expect(game.client.getView().action?.kind).toBe("fish");
    expect(game.client.getView().actionQueue).toEqual([fish]);
  });

  it("catches one fish for each queued fishing trip with another action behind it, then starts that action", () => {
    const game = createGame({ seed: 42 });
    giveRod(game);
    const [stick] = sticksNearPlayer(game, 1);
    const fish: ActionCommand = { type: "fish", ...riverSpotNearPlayer(game) };

    send(game, queued(fish));
    send(game, queued(fish));
    send(game, queued(pickUp(game, stick)));
    const player = onlyPlayer(game);
    stepUntil(game, () => (player.backpack.contents.rawFish ?? 0) === 1);
    expect(game.client.getView().actionQueue).toEqual([fish, pickUp(game, stick)]);
    stepUntil(game, () => player.approach !== undefined);

    expect(player.backpack.contents.rawFish).toBe(2);
    expect(player.fishTask).toBeUndefined();
    expect(game.client.getView().actionQueue).toEqual([pickUp(game, stick)]);
    stepUntil(game, () => !game.entities.has(stick));
  });

  it("sits only until another action waits behind it", () => {
    const game = createGame({ seed: 42 });
    const [stick] = sticksNearPlayer(game, 1);
    const { position } = onlyPlayer(game);
    const stool = game.entities.add({ furniture: "stool", position: { x: position.x - 3, y: position.y, z: position.z } });

    send(game, queued({ type: "sitOnStool", stoolId: idOf(game, stool) }));
    stepUntil(game, () => game.client.getView().sittingOn !== null);
    runSteps(game, 300);
    expect(game.client.getView().sittingOn).toBe(idOf(game, stool));

    send(game, queued(pickUp(game, stick)));

    expect(game.client.getView().sittingOn).toBeNull();
    expect(game.client.getView().actionQueue).toEqual([pickUp(game, stick)]);
  });

  it("sleeps until the player wakes, then carries on with the queue", () => {
    const game = createGame({ seed: 42 });
    const [stick] = sticksNearPlayer(game, 1);
    send(game, { type: "layBedroll" });
    stepUntil(game, () => game.entities.with("bedroll").size === 1);
    const bedroll = game.entities.with("bedroll").first;
    if (bedroll === undefined) throw new Error("No bedroll");
    onlyPlayer(game).needs.fatigue.level = 0.5;
    const hourBefore = game.client.getView().time.hour;

    send(game, queued({ type: "sleep", bedrollId: idOf(game, bedroll) }));
    send(game, queued(pickUp(game, stick)));
    stepUntil(game, () => !game.entities.has(stick));

    expect(game.client.getView().lastSleep?.count).toBe(1);
    expect(game.client.getView().time.hour).toBeGreaterThan(hourBefore);
  });
});

describe("emptying the action queue", () => {
  it("empties it when the player picks an action without Shift, and starts that action at once", () => {
    const game = createGame({ seed: 42 });
    const sticks = sticksNearPlayer(game, 4);
    for (const stick of sticks.slice(0, 3)) send(game, queued(pickUp(game, stick)));
    const plain = pickUp(game, sticks[3]);

    send(game, plain);

    expect(game.client.getView().actionQueue).toEqual([plain]);
    expect(onlyPlayer(game).approach?.command).toEqual({ type: "pickUpStick", stickId: idOf(game, sticks[3]) });
  });

  it("empties it when the player clicks the ground to walk there", () => {
    const game = createGame({ seed: 42 });
    for (const stick of sticksNearPlayer(game, 3)) send(game, queued(pickUp(game, stick)));
    const player = onlyPlayer(game);
    const walk: ActionCommand = { type: "walkTo", x: player.position.x - 2, z: player.position.z };

    send(game, walk);

    expect(game.client.getView().actionQueue).toEqual([walk]);
  });

  it("empties the actions waiting behind the one under way when the player eats, as eating does not stop it", () => {
    const game = createGame({ seed: 42 });
    const [first, second] = sticksNearPlayer(game, 2);
    onlyPlayer(game).backpack.contents.berries = 1;
    send(game, pickUp(game, first));
    send(game, queued(pickUp(game, second)));

    send(game, { type: "eat", food: "berries" });

    expect(game.client.getView().actionQueue).toEqual([pickUp(game, first)]);
    expect(onlyPlayer(game).approach?.command).toEqual({ type: "pickUpStick", stickId: idOf(game, first) });
  });

  it("empties it when the player collapses", () => {
    const game = createGame({ seed: 42 });
    for (const stick of sticksNearPlayer(game, 3)) send(game, queued(pickUp(game, stick)));

    // A night with no fire is too cold to get through.
    send(game, { type: "skipTime", hours: 30 });

    expect(game.client.getView().notice?.kind).toBe("collapsed");
    expect(game.client.getView().actionQueue).toEqual([]);
  });

  it("is not saved: a loaded game starts with an empty queue", () => {
    const game = createGame({ seed: 42 });
    for (const stick of sticksNearPlayer(game, 3)) send(game, queued(pickUp(game, stick)));

    const loaded = createGame({ seed: 42, progress: game.progress() });

    expect(loaded.client.getView().actionQueue).toEqual([]);
  });
});

describe("cancelling a queued action", () => {
  it("stops the action under way when it is cancelled, and starts the next one", () => {
    const game = createGame({ seed: 42 });
    const sticks = sticksNearPlayer(game, 3);
    for (const stick of sticks) send(game, queued(pickUp(game, stick)));

    send(game, { type: "cancelQueuedAction", index: 0 });

    expect(game.client.getView().actionQueue).toEqual([pickUp(game, sticks[1]), pickUp(game, sticks[2])]);
    expect(onlyPlayer(game).approach?.command).toEqual({ type: "pickUpStick", stickId: idOf(game, sticks[1]) });
    stepUntil(game, () => game.client.getView().actionQueue.length === 0);
    expect(game.entities.has(sticks[0] as Entity)).toBe(true);
  });

  it("takes out a middle action and leaves the one under way going", () => {
    const game = createGame({ seed: 42 });
    const sticks = sticksNearPlayer(game, 3);
    for (const stick of sticks) send(game, queued(pickUp(game, stick)));

    send(game, { type: "cancelQueuedAction", index: 1 });

    expect(game.client.getView().actionQueue).toEqual([pickUp(game, sticks[0]), pickUp(game, sticks[2])]);
    expect(onlyPlayer(game).approach?.command).toEqual({ type: "pickUpStick", stickId: idOf(game, sticks[0]) });
    stepUntil(game, () => game.client.getView().actionQueue.length === 0);
    expect(game.entities.has(sticks[1] as Entity)).toBe(true);
    expect(game.entities.has(sticks[2] as Entity)).toBe(false);
  });

  it("takes out the last action", () => {
    const game = createGame({ seed: 42 });
    const sticks = sticksNearPlayer(game, 3);
    for (const stick of sticks) send(game, queued(pickUp(game, stick)));

    send(game, { type: "cancelQueuedAction", index: 2 });

    expect(game.client.getView().actionQueue).toEqual([pickUp(game, sticks[0]), pickUp(game, sticks[1])]);
    stepUntil(game, () => game.client.getView().actionQueue.length === 0);
    expect(game.entities.has(sticks[2] as Entity)).toBe(true);
  });

  it("stops the player when they cancel the only action, and leaves the queue empty", () => {
    const game = createGame({ seed: 42 });
    const [stick] = sticksNearPlayer(game, 1);
    send(game, queued(pickUp(game, stick)));

    send(game, { type: "cancelQueuedAction", index: 0 });

    expect(game.client.getView().actionQueue).toEqual([]);
    expect(onlyPlayer(game).approach).toBeUndefined();
    expect(onlyPlayer(game).walkPath).toBeUndefined();
  });

  it("stops fishing when it is cancelled, though no action waits behind it", () => {
    const game = createGame({ seed: 42 });
    giveRod(game);
    send(game, queued({ type: "fish", ...riverSpotNearPlayer(game) }));
    stepUntil(game, () => game.client.getView().action?.kind === "fish");

    send(game, { type: "cancelQueuedAction", index: 0 });

    expect(game.client.getView().action).toBeNull();
    expect(game.client.getView().actionQueue).toEqual([]);
  });

  it("does nothing for a place in the queue that holds no action", () => {
    const game = createGame({ seed: 42 });
    const sticks = sticksNearPlayer(game, 2);
    for (const stick of sticks) send(game, queued(pickUp(game, stick)));

    send(game, { type: "cancelQueuedAction", index: 2 });
    send(game, { type: "cancelQueuedAction", index: -1 });

    expect(game.client.getView().actionQueue).toEqual(sticks.map((stick) => pickUp(game, stick)));
  });
});

/** Sends a command and runs one logic step, so the game carries it out. */
function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
}

function pickUp(game: Game, stick: Entity | undefined): ActionCommand {
  if (stick === undefined) throw new Error("No stick");
  return { type: "pickUpStick", stickId: idOf(game, stick) };
}

function onlyPlayer(game: Game) {
  const player = game.entities.with("player", "position", "backpack", "needs").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function idOf(game: Game, entity: Entity | undefined): number {
  const id = entity === undefined ? undefined : game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}

/** The `count` sticks nearest the player, nearest first. */
function sticksNearPlayer(game: Game, count: number): Entity[] {
  const sticks = byDistance(game, [...game.entities.with("stick", "position")]).slice(0, count);
  if (sticks.length < count) throw new Error("Not enough sticks");
  return sticks;
}

function nearestToPlayer(game: Game, kind: "tree"): Entity {
  const nearest = byDistance(game, [...game.entities.with(kind, "position")])[0];
  if (nearest === undefined) throw new Error(`No ${kind}`);
  return nearest;
}

function byDistance<T extends { position: GroundPoint }>(game: Game, entities: T[]): T[] {
  const { position } = onlyPlayer(game);
  const distance = (entity: T) => Math.hypot(entity.position.x - position.x, entity.position.z - position.z);
  return entities.sort((a, b) => distance(a) - distance(b));
}

/** Lays a log on the ground `dx` metres east of the player, and returns it. */
function layLog(game: Game, dx: number): Entity {
  const { position } = onlyPlayer(game);
  return game.entities.add({ log: { heading: 0 }, position: { x: position.x + dx, y: position.y, z: position.z } });
}

function giveRod(game: Game): void {
  onlyPlayer(game).backpack.contents.fishingRod = 1;
}

/** The middle of the river, level with the player. The player starts on the west bank. */
function riverSpotNearPlayer(game: Game): GroundPoint {
  const { position } = onlyPlayer(game);
  for (let x = position.x; x < position.x + 100; x += 0.25) {
    const spot = { x, z: position.z };
    if (distanceToRiver(game.valley.river, spot) - game.valley.river.width / 2 < -1) return spot;
  }
  throw new Error("No river near the player");
}

function stepUntil(game: Game, done: () => boolean, maxSteps = 100_000): void {
  for (let i = 0; i < maxSteps; i += 1) {
    if (done()) return;
    game.step();
  }
  throw new Error("Never happened");
}

function runSteps(game: Game, steps: number): void {
  for (let i = 0; i < steps; i += 1) game.step();
}
