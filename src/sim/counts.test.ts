import { describe, expect, it } from "bun:test";
import { addCount, countOf, holdsNone, takeCount, totalCount, weightedTotal, withoutEmptyKinds, type Counts } from "./counts";

type Kind = "stick" | "bark";

describe("material counts", () => {
  it("counts a kind it does not hold as zero", () => {
    const counts: Counts<Kind> = { stick: 2 };
    expect(countOf(counts, "bark")).toBe(0);
    expect(countOf(counts, "stick")).toBe(2);
  });

  it("adds to a kind, and leaves the record it was given alone", () => {
    const before: Counts<Kind> = { stick: 2 };
    expect(addCount(before, "stick", 3)).toEqual({ stick: 5 });
    expect(addCount(before, "bark", 1)).toEqual({ stick: 2, bark: 1 });
    expect(before).toEqual({ stick: 2 });
  });

  it("takes from a kind", () => {
    const before: Counts<Kind> = { stick: 5, bark: 1 };
    expect(takeCount(before, "stick", 2)).toEqual({ stick: 3, bark: 1 });
    expect(before).toEqual({ stick: 5, bark: 1 });
  });

  it("keeps a kind it took the last of, at zero", () => {
    expect(takeCount<Kind, Counts<Kind>>({ stick: 2 }, "stick", 2)).toEqual({ stick: 0 });
  });

  it("never takes a count below zero, even when asked for more than there is", () => {
    expect(takeCount<Kind, Counts<Kind>>({ stick: 2 }, "stick", 5)).toEqual({ stick: 0 });
    expect(takeCount<Kind, Counts<Kind>>({ stick: 2 }, "bark", 1)).toEqual({ stick: 2, bark: 0 });
  });

  it("totals every kind", () => {
    expect(totalCount<Kind>({ stick: 2, bark: 3 })).toBe(5);
    expect(totalCount<Kind>({})).toBe(0);
  });

  it("totals every kind by how much one of it weighs", () => {
    expect(weightedTotal<Kind>({ stick: 2, bark: 3 }, { stick: 0.5, bark: 2 })).toBe(7);
    expect(weightedTotal<Kind>({}, { stick: 0.5, bark: 2 })).toBe(0);
  });

  it("holds none when every kind is missing or zero", () => {
    expect(holdsNone<Kind>({})).toBe(true);
    expect(holdsNone<Kind>({ stick: 0, bark: 0 })).toBe(true);
    expect(holdsNone<Kind>({ stick: 0, bark: 1 })).toBe(false);
  });

  it("drops the kinds it holds none of", () => {
    expect(withoutEmptyKinds<Kind>({ stick: 0, bark: 2 })).toEqual({ bark: 2 });
  });
});
