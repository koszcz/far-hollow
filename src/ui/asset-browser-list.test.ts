import { describe, expect, it } from "bun:test";
import type { AssetEntry } from "../../scripts/asset-manifest";
import { groupAssets, isNotApproved, matchesSearch, neighbourId, NO_SHOWCASE_GROUP } from "./asset-browser-list";

function entry(id: string, description: string, status: "draft" | "pending" | "approved"): AssetEntry {
  const approval =
    status === "draft"
      ? { status, ticket: ".scratch/x/issues/01-x.md" }
      : status === "pending"
        ? { status }
        : { status, by: "owner" as const, date: "2026-11-24" };
  return { id, kind: "code", code: [], description, source: "Built in code", license: "Project code", approval };
}

const bed = entry("bed", "A plank bed with a blanket.", "approved");
const rain = entry("rain", "Rain falling over the valley.", "draft");
const owl = entry("owl", "A small bird that hoots at night.", "pending");
const lost = entry("lost", "An asset no showcase draws.", "approved");
const families = [
  { name: "building", ids: ["bed"] },
  { name: "weather", ids: ["rain"] },
  { name: "valley life", ids: ["owl"] },
];
const everything = { search: "", notApproved: false };

describe("asset browser search", () => {
  it("matches by id", () => {
    expect(matchesSearch(bed, "be")).toBe(true);
    expect(matchesSearch(rain, "be")).toBe(false);
  });

  it("matches by description, ignoring case", () => {
    expect(matchesSearch(owl, "HOOTS")).toBe(true);
    expect(matchesSearch(bed, "blanket")).toBe(true);
    expect(matchesSearch(bed, "hoots")).toBe(false);
  });

  it("matches every asset when the search is empty", () => {
    expect(matchesSearch(bed, "  ")).toBe(true);
  });

  it("keeps only groups with a match", () => {
    const groups = groupAssets([bed, rain, owl, lost], families, { search: "valley", notApproved: false });
    expect(groups.map((group) => group.name)).toEqual(["weather"]);
  });
});

describe("asset browser 'Not approved' filter", () => {
  it("counts drafts and pending assets as not approved", () => {
    expect([bed, rain, owl].map(isNotApproved)).toEqual([false, true, true]);
  });

  it("shows only draft and pending assets", () => {
    const groups = groupAssets([bed, rain, owl, lost], families, { search: "", notApproved: true });
    expect(groups.flatMap((group) => group.entries.map((shown) => shown.id))).toEqual(["rain", "owl"]);
  });

  it("works together with the search", () => {
    const groups = groupAssets([bed, rain, owl, lost], families, { search: "bird", notApproved: true });
    expect(groups.flatMap((group) => group.entries.map((shown) => shown.id))).toEqual(["owl"]);
  });
});

describe("asset browser groups", () => {
  it("groups by family in the families' order, with assets that have no showcase last", () => {
    const groups = groupAssets([lost, owl, rain, bed], families, everything);
    expect(groups.map((group) => [group.name, group.entries.map((shown) => shown.id)])).toEqual([
      ["building", ["bed"]],
      ["weather", ["rain"]],
      ["valley life", ["owl"]],
      [NO_SHOWCASE_GROUP, ["lost"]],
    ]);
  });

  it("moves up and down the list as shown, and stops at either end", () => {
    const groups = groupAssets([bed, rain, owl, lost], families, everything);
    expect(neighbourId(groups, "rain", 1)).toBe("owl");
    expect(neighbourId(groups, "rain", -1)).toBe("bed");
    expect(neighbourId(groups, "bed", -1)).toBe("bed");
    expect(neighbourId(groups, "lost", 1)).toBe("lost");
    expect(neighbourId(groups, "gone", 1)).toBe("bed");
  });
});
