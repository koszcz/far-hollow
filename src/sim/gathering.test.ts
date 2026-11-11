import { describe, expect, it } from "vitest";
import { BACKPACK_WEIGHT_LIMIT_KG } from "./backpack";
import type { Entity } from "./entities";
import { createGame, STEPS_PER_SECOND, type Game } from "./game";
import { FIREWOOD_PER_LOG, SPLIT_SECONDS } from "./gathering";

describe("picking up sticks", () => {
  it("lays the valley's sticks on the forest floor", () => {
    const game = createGame({ seed: 42 });
    const sticks = [...game.entities.with("stick", "position")];
    expect(sticks).toHaveLength(game.valley.sticks.length);
    expect(sticks[0]?.position).toMatchObject(game.valley.sticks[0] ?? {});
  });

  it("walks the player to a stick and puts it in the backpack", () => {
    const game = createGame({ seed: 42 });
    const stick = nearestToPlayer(game, "stick");
    const stickCount = game.entities.with("stick").size;

    game.client.send({ type: "pickUpStick", stickId: idOf(game, stick) });
    stepUntil(game, () => (game.client.getView().backpack.stick ?? 0) > 0);

    const player = onlyPlayer(game);
    expect(Math.hypot(player.position.x - stick.position.x, player.position.z - stick.position.z)).toBeLessThan(2);
    expect(game.client.getView().backpack.stick).toBe(1);
    expect(game.entities.with("stick").size).toBe(stickCount - 1);
    // The view shows the backpack's weight: the starting tools and empty pot, plus one stick.
    expect(game.client.getView().backpackWeight).toBeCloseTo(2.9 + 0.5);
    expect(game.client.getView().backpackWeightLimit).toBe(BACKPACK_WEIGHT_LIMIT_KG);
  });

  it("leaves the stick on the ground when the backpack is too full to take it", () => {
    const game = createGame({ seed: 42 });
    const player = onlyPlayer(game);
    fillBackpack(game);
    const stick = nearestToPlayer(game, "stick");

    game.client.send({ type: "pickUpStick", stickId: idOf(game, stick) });
    runSeconds(game, 30);

    expect(stick.stick).toBe(true);
    expect(game.entities.has(stick)).toBe(true);
    expect(player.backpack?.contents.stick ?? 0).toBe(0);
  });

  it("tells the player the backpack is full when it has no room for the stick", () => {
    const game = createGame({ seed: 42 });
    fillBackpack(game);
    const stick = nearestToPlayer(game, "stick");

    game.client.send({ type: "pickUpStick", stickId: idOf(game, stick) });
    game.step();

    expect(game.client.getView().notice).toBe("backpackFull");
  });
});

describe("splitting a log into firewood", () => {
  it("splits the log on the player's shoulder with the axe, and puts the firewood in the backpack", () => {
    const game = createGame({ seed: 42 });
    fellNearestTree(game);
    expect(game.client.getView().carrying).toBe("log");

    game.client.send({ type: "splitLog" });
    game.step();
    expect(game.client.getView().action?.kind).toBe("split");
    runSeconds(game, SPLIT_SECONDS / 2);
    expect(game.client.getView().action?.progress).toBeCloseTo(0.5, 1);
    expect(game.client.getView().backpack.firewood).toBeUndefined();

    runSeconds(game, SPLIT_SECONDS / 2 + 0.1);
    expect(game.client.getView().action).toBeNull();
    expect(game.client.getView().carrying).toBeNull();
    expect(game.client.getView().backpack.firewood).toBe(FIREWOOD_PER_LOG);
  });

  it("does nothing when the player carries no log", () => {
    const game = createGame({ seed: 42 });
    game.client.send({ type: "splitLog" });
    runSeconds(game, SPLIT_SECONDS * 2);
    expect(game.client.getView().action).toBeNull();
    expect(game.client.getView().backpack.firewood).toBeUndefined();
  });

  it("does nothing when the player has no axe", () => {
    const game = createGame({ seed: 42 });
    fellNearestTree(game);
    delete onlyPlayer(game).backpack?.contents.axe;

    game.client.send({ type: "splitLog" });
    runSeconds(game, SPLIT_SECONDS * 2);

    expect(game.client.getView().carrying).toBe("log");
    expect(game.client.getView().backpack.firewood).toBeUndefined();
  });

  it("keeps the log whole when the backpack has no room for its firewood", () => {
    const game = createGame({ seed: 42 });
    fellNearestTree(game);
    // 30 sticks weigh 15 kg, which with the 2.9 kg of tools and pot leaves room for only 1 piece of firewood.
    const backpack = onlyPlayer(game).backpack;
    if (backpack === undefined) throw new Error("No backpack");
    backpack.contents.stick = 30;

    game.client.send({ type: "splitLog" });
    game.step();
    expect(game.client.getView().notice).toBe("backpackFull");
    runSeconds(game, SPLIT_SECONDS * 2);

    expect(game.client.getView().carrying).toBe("log");
    expect(game.client.getView().backpack.firewood).toBeUndefined();
    expect(game.client.getView().backpackWeight).toBeLessThanOrEqual(BACKPACK_WEIGHT_LIMIT_KG);
  });

  it("stops splitting when the player is sent to walk somewhere else", () => {
    const game = createGame({ seed: 42 });
    fellNearestTree(game);
    game.client.send({ type: "splitLog" });
    runSeconds(game, SPLIT_SECONDS / 2);

    const player = onlyPlayer(game);
    game.client.send({ type: "walkTo", x: player.position.x - 3, z: player.position.z });
    runSeconds(game, SPLIT_SECONDS * 2);

    expect(game.client.getView().carrying).toBe("log");
    expect(game.client.getView().backpack.firewood).toBeUndefined();
  });
});

/** Chops down the tree nearest the player, who then carries one of its logs. */
function fellNearestTree(game: Game): void {
  const tree = nearestToPlayer(game, "tree");
  game.client.send({ type: "chopTree", treeId: idOf(game, tree) });
  stepUntil(game, () => tree.stump === true);
}

/** Packs the backpack so full that not even one stick fits. */
function fillBackpack(game: Game): void {
  const backpack = onlyPlayer(game).backpack;
  if (backpack === undefined) throw new Error("No backpack");
  // 11 pieces of firewood weigh 16.5 kg. With the tools, the pot, and two spare fire strikers, that makes 19.6 kg,
  // which leaves less room than one stick needs.
  backpack.contents.firewood = 11;
  backpack.contents.fireStriker = 3;
}

function stepUntil(game: Game, done: () => boolean, maxSteps = 100_000): number {
  for (let i = 0; i < maxSteps; i += 1) {
    if (done()) return i;
    game.step();
  }
  throw new Error("Never happened");
}

function runSeconds(game: Game, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * STEPS_PER_SECOND); i += 1) game.step();
}

function onlyPlayer(game: Game) {
  const player = game.entities.with("player", "position").first;
  if (player === undefined) throw new Error("No player");
  return player;
}

function nearestToPlayer(game: Game, kind: "stick" | "tree") {
  const player = onlyPlayer(game);
  const candidates = [...game.entities.with(kind, "position")];
  const distance = (entity: (typeof candidates)[number]) =>
    Math.hypot(entity.position.x - player.position.x, entity.position.z - player.position.z);
  const nearest = candidates.sort((a, b) => distance(a) - distance(b))[0];
  if (nearest === undefined) throw new Error(`No ${kind}`);
  return nearest;
}

function idOf(game: Game, entity: Entity): number {
  const id = game.entities.id(entity);
  if (id === undefined) throw new Error("Entity is not in the store");
  return id;
}
