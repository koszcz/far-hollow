import { describe, expect, it } from "bun:test";
import type { BackpackContent, GameView } from "../sim/api";
import { createGame } from "../sim/game";
import { clickHotbarCell, pressHotbarKey } from "./hotbar";
import type { ActionReader } from "./thing-actions";

describe("a click on a hotbar cell", () => {
  it("uses the backpack content", () => {
    const reader = readerWith({ backpack: { berries: 1, mushroom: 1, bedroll: 1, pot: 1, potOfRiverWater: 1, potOfBoiledWater: 1 } });
    const click = (content: BackpackContent) => clickHotbarCell({ kind: "backpackContent", content }, reader, false);

    expect(click("berries")).toEqual({ type: "eat", food: "berries" });
    expect(click("mushroom")).toEqual({ type: "eat", food: "mushroom" });
    expect(click("bedroll")).toEqual({ type: "layBedroll" });
    expect(click("pot")).toEqual({ type: "fillPot" });
    expect(click("potOfRiverWater")).toEqual({ type: "drinkFromPot" });
    expect(click("potOfBoiledWater")).toEqual({ type: "drinkFromPot" });
  });

  it("does nothing for a backpack content with no use", () => {
    expect(clickHotbarCell({ kind: "backpackContent", content: "stick" }, readerWith({ backpack: { stick: 3 } }), false)).toBeUndefined();
  });

  it("puts one in an open chest, or all with shift held", () => {
    const reader = readerWith({ backpack: { berries: 3 }, openChestId: 12 });

    expect(clickHotbarCell({ kind: "backpackContent", content: "berries" }, reader, false)).toEqual({
      type: "putInChest",
      chestId: 12,
      content: "berries",
      all: false,
    });
    expect(clickHotbarCell({ kind: "backpackContent", content: "berries" }, reader, true)).toEqual({
      type: "putInChest",
      chestId: 12,
      content: "berries",
      all: true,
    });
  });

  it("drops the log on the shoulder", () => {
    expect(clickHotbarCell({ kind: "shoulder", log: "log" }, readerWith({ carrying: "log" }), false)).toEqual({ type: "dropLog" });
  });

  it("lets go of the sled the player drags", () => {
    expect(clickHotbarCell({ kind: "sled", sledId: 9 }, readerWith({ draggingSledId: 9 }), false)).toEqual({ type: "letGoOfSled" });
  });
});

describe("the number keys", () => {
  it("use the backpack content in that cell, not counting the shoulder", () => {
    const reader = readerWith({ backpack: { axe: 1, pot: 1, berries: 2 }, carrying: "log" });

    expect(pressHotbarKey("Digit1", reader, NOT_TYPING)).toBeUndefined();
    expect(pressHotbarKey("Digit2", reader, NOT_TYPING)).toEqual({ type: "fillPot" });
    expect(pressHotbarKey("Numpad3", reader, NOT_TYPING)).toEqual({ type: "eat", food: "berries" });
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
    draggingSledId === undefined ? null : { id: draggingSledId, contents: { log: 0, debarkedLog: 0 }, total: 0, capacity: 6 };
  const nearby: GameView["nearby"] =
    openChestId === undefined ? [] : [{ kind: "openChest", view: { id: openChestId, contents: {}, weight: 0, weightLimit: 30 } }];
  const view: GameView = { ...START.getView(), backpack, carrying, nearby, dragging };
  return { ...START, getView: () => view };
}
