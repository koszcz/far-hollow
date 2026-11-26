import { describe, expect, it } from "bun:test";
import { driedFirst, driedFor, dryProgress, DRY_MINUTES, hasSpoiled, hungOnRack, isDried, takenAs } from "./rack-food";

describe("food on a drying rack", () => {
  it("starts fresh, with its spoil time", () => {
    const berries = hungOnRack("berries", 500);
    expect(berries).toEqual({ food: "berries", minutesDried: 0, spoilsAt: 500 });
    expect(isDried(berries)).toBe(false);
    expect(dryProgress(berries)).toBe(0);
    expect(takenAs(berries)).toBe("berries");
  });

  it("dries after DRY_MINUTES, then stops counting and loses its spoil time", () => {
    const half = driedFor(hungOnRack("mushroom", 5000), DRY_MINUTES / 2);
    expect(dryProgress(half)).toBeCloseTo(0.5, 5);
    const dried = driedFor(half, DRY_MINUTES);
    expect(dried).toEqual({ food: "mushroom", minutesDried: DRY_MINUTES });
    expect(takenAs(dried)).toBe("driedMushroom");
    expect(driedFor(dried, 100)).toBe(dried);
  });

  it("spoils at its spoil time while fresh, and never once dried", () => {
    const berries = hungOnRack("berries", 500);
    expect(hasSpoiled(berries, 499)).toBe(false);
    expect(hasSpoiled(berries, 500)).toBe(true);
    expect(hasSpoiled(driedFor(berries, DRY_MINUTES), 1_000_000)).toBe(false);
  });

  it("lists dried food first, each in the order it was hung", () => {
    const fresh = hungOnRack("berries", 500);
    const dried = driedFor(hungOnRack("mushroom", 500), DRY_MINUTES);
    const alsoFresh = hungOnRack("mushroom", 900);
    expect(driedFirst([fresh, dried, alsoFresh])).toEqual([dried, fresh, alsoFresh]);
  });
});
