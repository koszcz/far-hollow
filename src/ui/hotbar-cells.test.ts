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
      dragging: { id: 9, contents: { log: 3, debarkedLog: 1, plank: 0 }, total: 4, capacity: 6, logsThatFit: 2, planksThatFit: 8 },
      backpack: { axe: 1 },
    });

    expect(cells.map(({ target, name, count, key }) => [target, name, count, key])).toEqual([
      [{ kind: "sled", sledId: 9 }, "Sled 4/6", 1, undefined],
      [{ kind: "backpackContent", content: "axe" }, "Axe", 1, "1"],
    ]);
  });

  it("shows the lit torch in the player's hand after the shoulder, with a gauge of its burning time left", () => {
    const cells = hotbarCells({
      carrying: "log",
      dragging: null,
      litTorch: { minutesLeft: 130, burnLeft: 130 / 180 },
      backpack: { torch: 2 },
    });

    expect(cells.map(({ target, name, count, key, gauge }) => [target, name, count, key, gauge])).toEqual([
      [{ kind: "shoulder", log: "log" }, "Log", 1, undefined, undefined],
      [{ kind: "litTorch" }, "Lit torch", 1, undefined, 130 / 180],
      [{ kind: "backpackContent", content: "torch" }, "Torch", 2, "1", undefined],
    ]);
    expect(cells[1]?.tip).toBe("Lit torch · 2 h 10 min left");
  });

  it("counts each plank on the sled as a quarter of a log space", () => {
    const cells = hotbarCells({
      carrying: null,
      dragging: { id: 9, contents: { log: 1, debarkedLog: 0, plank: 2 }, total: 1.5, capacity: 6, logsThatFit: 4, planksThatFit: 18 },
      backpack: {},
    });

    expect(cells[0]?.name).toBe("Sled 1.5/6");
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

  it("adds how much a backpack cell's contents weigh to its label, but not to the shoulder or sled", () => {
    const cells = hotbarCells({
      carrying: "log",
      dragging: null,
      backpack: { axe: 1, plank: 5, berries: 3 },
    });

    expect(cells.map(({ tip }) => tip)).toEqual(["Log", "Axe · 1.5 kg", "Berries ×3 · 0.3 kg", "Plank ×5 · 10 kg"]);
  });
});
