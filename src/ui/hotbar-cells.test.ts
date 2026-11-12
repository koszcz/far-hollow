import { describe, expect, it } from "bun:test";
import { hotbarCells } from "./hotbar-cells";

describe("the hotbar cells", () => {
  it("shows the log on the shoulder first, then each kind in the backpack, numbered 1 to 9", () => {
    const cells = hotbarCells({
      carrying: "debarkedLog",
      dragging: null,
      backpack: { axe: 1, berries: 3, stick: 2 },
    });

    expect(cells.map(({ target, name, count, key }) => [target.kind, name, count, key])).toEqual([
      ["shoulder", "Debarked log", 1, undefined],
      ["backpackContent", "Axe", 1, "1"],
      ["backpackContent", "Stick", 2, "2"],
      ["backpackContent", "Berries", 3, "3"],
    ]);
  });

  it("shows the sled the player drags where the shoulder cell goes, with how many logs it holds", () => {
    const cells = hotbarCells({
      carrying: null,
      dragging: { id: 9, contents: { log: 3, debarkedLog: 1 }, total: 4, capacity: 6 },
      backpack: { axe: 1 },
    });

    expect(cells.map(({ target, name, count, key }) => [target, name, count, key])).toEqual([
      [{ kind: "sled", sledId: 9 }, "Sled 4/6", 1, undefined],
      [{ kind: "backpackContent", content: "axe" }, "Axe", 1, "1"],
    ]);
  });

  it("gives no key to the tenth kind and after", () => {
    const cells = hotbarCells({
      carrying: null,
      dragging: null,
      backpack: {
        axe: 1,
        knife: 1,
        drawknife: 1,
        steelAndFlint: 1,
        bedroll: 1,
        stick: 1,
        firewood: 1,
        bark: 1,
        pot: 1,
        berries: 1,
        mushroom: 1,
      },
    });

    expect(cells.map(({ key }) => key)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", undefined, undefined]);
  });
});
