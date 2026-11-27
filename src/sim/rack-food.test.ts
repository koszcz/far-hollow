import { describe, expect, it } from "bun:test";
import {
  DRY_MINUTES,
  hasSpoiled,
  hungOnRack,
  isPreserved,
  isRackFood,
  preservedFirst,
  preservedFor,
  preserveProgress,
  SMOKE_MINUTES,
  takenAs,
  waitsForFire,
} from "./rack-food";

describe("food on a drying rack", () => {
  it("starts fresh, with its spoil time", () => {
    const berries = hungOnRack("berries", 500);
    expect(berries).toEqual({ food: "berries", minutesPreserved: 0, spoilsAt: 500 });
    expect(isPreserved(berries)).toBe(false);
    expect(preserveProgress(berries)).toBe(0);
    expect(takenAs(berries)).toBe("berries");
  });

  it("dries after DRY_MINUTES with or without a fire, then stops counting and loses its spoil time", () => {
    const half = preservedFor(hungOnRack("mushroom", 5000), DRY_MINUTES / 2, false);
    expect(preserveProgress(half)).toBeCloseTo(0.5, 5);
    const dried = preservedFor(half, DRY_MINUTES, true);
    expect(dried).toEqual({ food: "mushroom", minutesPreserved: DRY_MINUTES });
    expect(takenAs(dried)).toBe("driedMushroom");
    expect(preservedFor(dried, 100, false)).toBe(dried);
  });

  it("smokes raw fish after SMOKE_MINUTES only while a fire is close by", () => {
    const fish = hungOnRack("rawFish", 5000);
    expect(preservedFor(fish, 60, false)).toBe(fish);
    expect(waitsForFire(fish, false)).toBe(true);
    expect(waitsForFire(fish, true)).toBe(false);

    const half = preservedFor(fish, SMOKE_MINUTES / 2, true);
    expect(preserveProgress(half)).toBeCloseTo(0.5, 5);
    const smoked = preservedFor(half, SMOKE_MINUTES, true);
    expect(smoked).toEqual({ food: "rawFish", minutesPreserved: SMOKE_MINUTES });
    expect(takenAs(smoked)).toBe("smokedFish");
    expect(waitsForFire(smoked, false)).toBe(false);
  });

  it("spoils at its spoil time while fresh, and never once preserved", () => {
    const berries = hungOnRack("berries", 500);
    expect(hasSpoiled(berries, 499)).toBe(false);
    expect(hasSpoiled(berries, 500)).toBe(true);
    expect(hasSpoiled(preservedFor(berries, DRY_MINUTES, false), 1_000_000)).toBe(false);
    expect(hasSpoiled(preservedFor(hungOnRack("rawFish", 500), SMOKE_MINUTES, true), 1_000_000)).toBe(false);
  });

  it("lists preserved food first, each in the order it was hung", () => {
    const fresh = hungOnRack("berries", 500);
    const dried = preservedFor(hungOnRack("mushroom", 500), DRY_MINUTES, false);
    const alsoFresh = hungOnRack("mushroom", 900);
    expect(preservedFirst([fresh, dried, alsoFresh])).toEqual([dried, fresh, alsoFresh]);
  });

  it("takes every fresh food but cooked fish", () => {
    expect(isRackFood("rawFish")).toBe(true);
    expect(isRackFood("cookedFish")).toBe(false);
  });
});
