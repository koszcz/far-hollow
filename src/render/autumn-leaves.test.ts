import { describe, expect, it } from "bun:test";
import type { SeasonDay } from "../sim/season";
import { AUTUMN_CROWN_COLOURS, AUTUMN_CROWN_FALLBACK, crownColour, isBroadleaf, leafTurnShare } from "./autumn-leaves";
import { TREE_COLOURS } from "./tree-model";

const day = (season: SeasonDay["season"], dayOfSeason: number): SeasonDay => ({ season, dayOfSeason, seasonDays: 7 });
const AFTER_WINTER = { afterWinter: true };

describe("leafTurnShare", () => {
  it("is green all summer and from spring day 3 on", () => {
    for (const d of [1, 4, 7]) expect(leafTurnShare(day("summer", d), 12, AFTER_WINTER)).toBe(0);
    expect(leafTurnShare(day("spring", 3), 0, AFTER_WINTER)).toBe(0);
    expect(leafTurnShare(day("spring", 7), 23, AFTER_WINTER)).toBe(0);
  });

  it("starts green at the start of autumn and is fully amber by the end of autumn day 3", () => {
    expect(leafTurnShare(day("autumn", 1), 0, AFTER_WINTER)).toBe(0);
    const midway = leafTurnShare(day("autumn", 2), 12, AFTER_WINTER);
    expect(midway).toBeGreaterThan(0.3);
    expect(midway).toBeLessThan(0.7);
    expect(leafTurnShare(day("autumn", 3), 23.99, AFTER_WINTER)).toBeCloseTo(1, 2);
    expect(leafTurnShare(day("autumn", 4), 0, AFTER_WINTER)).toBe(1);
  });

  it("turns more amber hour by hour through the first days of autumn", () => {
    const morning = leafTurnShare(day("autumn", 1), 8, AFTER_WINTER);
    const evening = leafTurnShare(day("autumn", 1), 20, AFTER_WINTER);
    expect(evening).toBeGreaterThan(morning);
  });

  it("stays amber all winter", () => {
    for (const d of [1, 4, 7]) expect(leafTurnShare(day("winter", d), 12, AFTER_WINTER)).toBe(1);
  });

  it("returns to green over spring day 1 and 2", () => {
    expect(leafTurnShare(day("spring", 1), 0, AFTER_WINTER)).toBe(1);
    const midway = leafTurnShare(day("spring", 2), 0, AFTER_WINTER);
    expect(midway).toBeGreaterThan(0.3);
    expect(midway).toBeLessThan(0.7);
    expect(leafTurnShare(day("spring", 2), 23.99, AFTER_WINTER)).toBeCloseTo(0, 2);
  });

  it("is green all through a spring that no winter came before, such as a new game's first spring", () => {
    for (const d of [1, 2, 7]) expect(leafTurnShare(day("spring", d), 0, { afterWinter: false })).toBe(0);
  });
});

describe("isBroadleaf", () => {
  it("counts the oaks and leafy trees as broadleaf, and the pines as conifers", () => {
    for (const name of ["tree_oak", "tree_default", "tree_tall", "tree_detailed"]) expect(isBroadleaf(name)).toBe(true);
    for (const name of ["tree_pineDefaultA", "tree_pineDefaultB", "tree_pineTallA", "tree_pineRoundA"]) expect(isBroadleaf(name)).toBe(false);
  });
});

describe("crownColour", () => {
  const broadleafNames = ["tree_oak", "tree_default", "tree_detailed", "tree_tall"];

  it("is the summer green with no turn, and the type's autumn colour with a full turn", () => {
    expect(crownColour({ name: "tree_oak", crownTone: "light" }, 0).getHex()).toBe(TREE_COLOURS.crown.light);
    expect(crownColour({ name: "tree_oak", crownTone: "dark" }, 1).getHex()).toBe(AUTUMN_CROWN_COLOURS.tree_oak);
  });

  it("gives every broadleaf type its own warm colour: more red than green, and more green than blue", () => {
    const colours = broadleafNames.map((name) => crownColour({ name, crownTone: "light" }, 1));
    expect(new Set(colours.map((colour) => colour.getHex())).size).toBe(broadleafNames.length);
    for (const colour of colours) {
      expect(colour.r).toBeGreaterThan(colour.g);
      expect(colour.g).toBeGreaterThan(colour.b);
    }
  });

  it("gives a broadleaf type with no colour of its own the fallback colour", () => {
    expect(crownColour({ name: "tree_unknown", crownTone: "light" }, 1).getHex()).toBe(AUTUMN_CROWN_FALLBACK);
  });
});
