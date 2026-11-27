import { describe, expect, it } from "bun:test";
import type { BackpackContent } from "../sim/api";
import type { GameView } from "../sim/api-game-view";
import { createGame } from "../sim/game";
import { hotbarKeyPlanting, mainHotbarCommand, pressHotbarKey } from "./hotbar";
import { menuActions } from "./thing-actions";
import type { ActionReader } from "./thing-actions-context";

describe("a hotbar cell's main action", () => {
  it("uses the backpack content", () => {
    const reader = readerWith({ backpack: { berries: 1, mushroom: 1, bedroll: 1, pot: 1, potOfRiverWater: 1, potOfBoiledWater: 1 } });
    const click = (content: BackpackContent) => mainHotbarCommand({ kind: "backpackContent", content }, reader);

    expect(click("berries")).toEqual({ type: "eat", food: "berries" });
    expect(click("mushroom")).toEqual({ type: "eat", food: "mushroom" });
    expect(click("bedroll")).toEqual({ type: "layBedroll" });
    expect(click("pot")).toEqual({ type: "fillPot" });
    expect(click("potOfRiverWater")).toEqual({ type: "drinkFromPot" });
    expect(click("potOfBoiledWater")).toEqual({ type: "drinkFromPot" });
  });

  it("does nothing for a backpack content with no use", () => {
    expect(mainHotbarCommand({ kind: "backpackContent", content: "stick" }, readerWith({ backpack: { stick: 3 } }))).toBeUndefined();
  });

  it("puts one in an open chest", () => {
    const reader = readerWith({ backpack: { berries: 3 }, openChestId: 12 });

    expect(mainHotbarCommand({ kind: "backpackContent", content: "berries" }, reader)).toEqual({
      type: "putInChest",
      chestId: 12,
      content: "berries",
      all: false,
    });
  });

  it("drops the log on the shoulder", () => {
    expect(mainHotbarCommand({ kind: "shoulder", log: "log" }, readerWith({ carrying: "log" }))).toEqual({ type: "dropLog" });
  });

  it("lets go of the sled the player drags", () => {
    expect(mainHotbarCommand({ kind: "sled", sledId: 9 }, readerWith({ draggingSledId: 9 }))).toEqual({ type: "letGoOfSled" });
  });
});

describe("a sapling's hotbar cell", () => {
  it("offers planting it as the main action, which sends no command but starts placing a see-through sapling, then dropping it", () => {
    const actions = menuActions({ kind: "backpackContent", content: "sapling" }, readerWith({ backpack: { sapling: 2 } }));

    expect(actions.map(({ id }) => id)).toEqual(["plant", "drop"]);
    expect(actions[0]).toMatchObject({ isMain: true, enabled: true, label: "Plant", command: undefined, startsPlanting: "sapling" });
  });

  it("starts planting from its number key", () => {
    const reader = readerWith({ backpack: { sapling: 2, berries: 1 } });

    expect(hotbarKeyPlanting("Digit1", reader, NOT_TYPING)).toBe("sapling");
    expect(pressHotbarKey("Digit1", reader, NOT_TYPING)).toBeUndefined();
    expect(hotbarKeyPlanting("Digit2", reader, NOT_TYPING)).toBeUndefined();
    expect(hotbarKeyPlanting("Digit1", reader, { typing: true })).toBeUndefined();
  });
});

describe("a berry bush's hotbar cell", () => {
  it("offers planting it as the main action, which starts placing a see-through bush, then dropping it", () => {
    const actions = menuActions({ kind: "backpackContent", content: "berryBush" }, readerWith({ backpack: { berryBush: 2 } }));

    expect(actions.map(({ id }) => id)).toEqual(["plant", "drop"]);
    expect(actions[0]).toMatchObject({ isMain: true, enabled: true, label: "Plant", command: undefined, startsPlanting: "berryBush" });
  });

  it("starts planting a berry bush from its number key", () => {
    const reader = readerWith({ backpack: { berryBush: 1 } });

    expect(hotbarKeyPlanting("Digit1", reader, NOT_TYPING)).toBe("berryBush");
  });
});

describe("the number keys", () => {
  it("use the backpack content in that cell, not counting the shoulder", () => {
    const reader = readerWith({ backpack: { axe: 1, pot: 1, berries: 2 }, carrying: "log" });

    expect(pressHotbarKey("Digit1", reader, NOT_TYPING)).toBeUndefined();
    expect(pressHotbarKey("Digit2", reader, NOT_TYPING)).toEqual({ type: "fillPot" });
    expect(pressHotbarKey("Numpad3", reader, NOT_TYPING)).toEqual({ type: "eat", food: "berries" });
  });

  it("with Shift, add the backpack content's main action to the action queue", () => {
    const reader = readerWith({ backpack: { berries: 2 } });

    expect(pressHotbarKey("Digit1", reader, { typing: false, shift: true })).toEqual({ type: "queueAction", action: { type: "eat", food: "berries" } });
    expect(pressHotbarKey("Digit2", reader, { typing: false, shift: true })).toBeUndefined();
  });

  it("do nothing for an empty cell or another key", () => {
    const reader = readerWith({ backpack: { berries: 2 } });

    expect(pressHotbarKey("Digit2", reader, NOT_TYPING)).toBeUndefined();
    expect(pressHotbarKey("Digit0", reader, NOT_TYPING)).toBeUndefined();
    expect(pressHotbarKey("KeyE", reader, NOT_TYPING)).toBeUndefined();
  });

  it("do nothing while the player types in a form field", () => {
    expect(pressHotbarKey("Digit1", readerWith({ backpack: { berries: 2 } }), { typing: true })).toBeUndefined();
  });
});

const NOT_TYPING = { typing: false };
const START = createGame({ seed: 42 }).client;

/** A reader whose view has this backpack and shoulder, and an open chest with this id if given. */
function readerWith({
  backpack = {},
  carrying = null,
  openChestId,
  draggingSledId,
}: {
  backpack?: Partial<Record<BackpackContent, number>>;
  carrying?: GameView["carrying"];
  openChestId?: number;
  draggingSledId?: number;
}): ActionReader {
  const dragging: GameView["dragging"] =
    draggingSledId === undefined
      ? null
      : { id: draggingSledId, contents: { log: 0, debarkedLog: 0, plank: 0 }, total: 0, capacity: 6, logsThatFit: 6, planksThatFit: 24 };
  const nearby: GameView["nearby"] =
    openChestId === undefined
      ? []
      : [{ kind: "openChest", view: { id: openChestId, furniture: "chest", contents: {}, weight: 0, weightLimit: 60, freshness: {} } }];
  const view: GameView = { ...START.getView(), backpack, carrying, nearby, dragging };
  return { ...START, getView: () => view };
}
