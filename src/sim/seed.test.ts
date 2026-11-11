import { describe, expect, it } from "vitest";
import { seedFromText } from "./seed";

describe("turning what the player types into a seed", () => {
  it("uses a typed whole number as the seed", () => {
    expect(seedFromText("42")).toBe(42);
    expect(seedFromText(" 7 ")).toBe(7);
    expect(seedFromText("4294967295")).toBe(4_294_967_295);
  });

  it("gives no seed for blank text, so the game picks a random one", () => {
    expect(seedFromText("")).toBeUndefined();
    expect(seedFromText("   ")).toBeUndefined();
  });

  it("turns any other text into a seed, the same one every time", () => {
    const seed = seedFromText("Far Hollow");
    expect(seed).toBe(seedFromText("Far Hollow"));
    expect(seed).not.toBe(seedFromText("Far Hollows"));
    for (const text of ["Far Hollow", "-5", "4294967296", "1.5"]) {
      const each = seedFromText(text);
      expect(Number.isSafeInteger(each) && (each ?? -1) >= 0 && (each ?? 2 ** 32) < 2 ** 32).toBe(true);
    }
  });
});
