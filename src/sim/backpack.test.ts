import { describe, expect, it } from "vitest";
import { addToBackpack, BACKPACK_WEIGHT_LIMIT_KG, backpackWeight, countInBackpack, createStartingBackpack } from "./backpack";

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
