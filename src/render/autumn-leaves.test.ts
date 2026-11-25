import { describe, expect, it } from "bun:test";
import type { SeasonDay } from "../sim/season";
import { AUTUMN_CROWN_COLOURS, crownColour, isBroadleaf, leafTurnShare } from "./autumn-leaves";
import { TREE_COLOURS } from "./forest-meshes";

const day = (season: SeasonDay["season"], dayOfSeason: number): SeasonDay => ({ season, dayOfSeason, seasonDays: 7 });

describe("leafTurnShare", () => {
  it("is green all summer and from spring day 3 on", () => {
    for (const d of [1, 4, 7]) expect(leafTurnShare(day("summer", d), 12)).toBe(0);
    expect(leafTurnShare(day("spring", 3), 0)).toBe(0);
    expect(leafTurnShare(day("spring", 7), 23)).toBe(0);
  });

  it("starts green at the start of autumn and is fully amber by the end of autumn day 3", () => {
    expect(leafTurnShare(day("autumn", 1), 0)).toBe(0);
    const midway = leafTurnShare(day("autumn", 2), 12);
    expect(midway).toBeGreaterThan(0.3);
    expect(midway).toBeLessThan(0.7);
    expect(leafTurnShare(day("autumn", 3), 23.99)).toBeCloseTo(1, 2);
    expect(leafTurnShare(day("autumn", 4), 0)).toBe(1);
  });

  it("turns more amber hour by hour through the first days of autumn", () => {
    const morning = leafTurnShare(day("autumn", 1), 8);
    const evening = leafTurnShare(day("autumn", 1), 20);
    expect(evening).toBeGreaterThan(morning);
  });

  it("stays amber all winter", () => {
    for (const d of [1, 4, 7]) expect(leafTurnShare(day("winter", d), 12)).toBe(1);
  });

  it("returns to green over spring day 1 and 2", () => {
    expect(leafTurnShare(day("spring", 1), 0)).toBe(1);
    const midway = leafTurnShare(day("spring", 2), 0);
    expect(midway).toBeGreaterThan(0.3);
    expect(midway).toBeLessThan(0.7);
    expect(leafTurnShare(day("spring", 2), 23.99)).toBeCloseTo(0, 2);
  });
});

describe("isBroadleaf", () => {
  it("counts the oaks and leafy trees as broadleaf, and the pines as conifers", () => {
    for (const name of ["tree_oak", "tree_default", "tree_tall", "tree_detailed"]) expect(isBroadleaf(name)).toBe(true);
    for (const name of ["tree_pineDefaultA", "tree_pineDefaultB", "tree_pineTallA", "tree_pineRoundA"]) expect(isBroadleaf(name)).toBe(false);
  });
});

describe("crownColour", () => {
  it("is the summer green with no turn, and the autumn amber with a full turn", () => {
    expect(crownColour("light", 0).getHex()).toBe(TREE_COLOURS.crown.light);
    expect(crownColour("dark", 1).getHex()).toBe(AUTUMN_CROWN_COLOURS.dark);
  });

  it("is amber: more red than green, and more green than blue", () => {
    const amber = crownColour("light", 1);
    expect(amber.r).toBeGreaterThan(amber.g);
    expect(amber.g).toBeGreaterThan(amber.b);
  });
});
