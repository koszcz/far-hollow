import { describe, expect, it } from "bun:test";
import {
  addToBackpack,
  BACKPACK_WEIGHT_LIMIT_KG,
  backpackWeight,
  countInBackpack,
  createStartingBackpack,
  removeFromBackpack,
  swapInBackpack,
} from "./backpack";

describe("the backpack's weight limit", () => {
  it("weighs what it holds", () => {
    const backpack = { contents: { stick: 2, firewood: 1 } };
    // A stick weighs 0.5 kg and a piece of firewood weighs 1.5 kg.
    expect(backpackWeight(backpack)).toBeCloseTo(2.5);
  });

  it("takes things in while they fit", () => {
    const backpack = createStartingBackpack();
    expect(addToBackpack(backpack, "stick", 3)).toBe(true);
    expect(countInBackpack(backpack, "stick")).toBe(3);
  });

  it("refuses anything that would take it over the limit, and keeps what it held", () => {
    const backpack = createStartingBackpack();
    const room = BACKPACK_WEIGHT_LIMIT_KG - backpackWeight(backpack);
    const sticksThatFit = Math.floor(room / 0.5);
    expect(addToBackpack(backpack, "stick", sticksThatFit)).toBe(true);

    expect(addToBackpack(backpack, "stick", 1)).toBe(false);
    expect(addToBackpack(backpack, "firewood", 1)).toBe(false);
    expect(countInBackpack(backpack, "stick")).toBe(sticksThatFit);
    expect(countInBackpack(backpack, "firewood")).toBe(0);
    expect(backpackWeight(backpack)).toBeLessThanOrEqual(BACKPACK_WEIGHT_LIMIT_KG);
  });
});

describe("taking things out of the backpack", () => {
  it("takes out what it holds", () => {
    const backpack = { contents: { stick: 3 } };
    expect(removeFromBackpack(backpack, "stick", 2)).toBe(true);
    expect(countInBackpack(backpack, "stick")).toBe(1);
  });

  it("refuses to take out more than it holds, and keeps what it held", () => {
    const backpack = { contents: { stick: 1 } };
    expect(removeFromBackpack(backpack, "stick", 2)).toBe(false);
    expect(removeFromBackpack(backpack, "firewood", 1)).toBe(false);
    expect(countInBackpack(backpack, "stick")).toBe(1);
    expect(countInBackpack(backpack, "firewood")).toBe(0);
  });
});

describe("swapping one thing in the backpack for another", () => {
  it("takes one out and puts the other in", () => {
    const backpack = { contents: { pot: 1 } };
    expect(swapInBackpack(backpack, "pot", "potOfBoiledWater")).toBe(true);
    expect(countInBackpack(backpack, "pot")).toBe(0);
    expect(countInBackpack(backpack, "potOfBoiledWater")).toBe(1);
  });

  it("refuses, and keeps what it held, when the backpack holds none of the first", () => {
    const backpack = { contents: { stick: 1 } };
    expect(swapInBackpack(backpack, "pot", "potOfBoiledWater")).toBe(false);
    expect(backpack.contents).toEqual({ stick: 1 });
  });

  it("refuses, and keeps what it held, when the other does not fit once the first is out", () => {
    const backpack = { contents: { jug: 1 } };
    while (addToBackpack(backpack, "stick", 1));
    const weight = backpackWeight(backpack);

    expect(swapInBackpack(backpack, "jug", "jugWith1Drink")).toBe(false);
    expect(countInBackpack(backpack, "jug")).toBe(1);
    expect(countInBackpack(backpack, "jugWith1Drink")).toBe(0);
    expect(backpackWeight(backpack)).toBe(weight);
  });
});
