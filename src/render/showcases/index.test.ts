import { describe, expect, it } from "bun:test";
import { SHOWCASE_FAMILIES, SHOWCASES } from "./index";

/** The showcases that src/app/showcase.ts listed by hand before the `overlay` field, to draw the HUD over them. */
const OLD_HUD_IDS = [
  "hud",
  "bark",
  "stone",
  "clay",
  "jug",
  "jug-icons",
  "sapling-icon",
  "berry-bush-icon",
  "backpack-icons",
  "build-icons",
  "crafting-icons",
  "fishing-icons",
  "sled-icon",
  "furniture-icons",
  "fireplace-icon",
  "rain-barrel-icon",
  "floor-and-door-icons",
  "window-icons",
  "action-queue-icons",
  "torch-icons",
  "fish-trap-icons",
];

const idsWithOverlay = (overlay: "hud" | "sound"): string[] =>
  Object.entries(SHOWCASES)
    .filter(([, showcase]) => showcase.overlay === overlay)
    .map(([id]) => id)
    .sort();

describe("showcase families", () => {
  it("puts every showcase id in exactly one family", () => {
    const familyIds = SHOWCASE_FAMILIES.flatMap((family) => Object.keys(family.showcases));
    expect(familyIds.filter((id, index) => familyIds.indexOf(id) !== index)).toEqual([]);
    expect([...familyIds].sort()).toEqual(Object.keys(SHOWCASES).sort());
  });

  it("names the eight families the asset browser groups by", () => {
    expect(SHOWCASE_FAMILIES.map((family) => family.name)).toEqual([
      "nature",
      "building",
      "camp",
      "interface",
      "weather",
      "valley life",
      "sound",
      "animations",
    ]);
  });
});

describe("showcase overlay", () => {
  it('marks the same assets with "hud" as the old hand-written HUD list', () => {
    expect(idsWithOverlay("hud")).toEqual([...OLD_HUD_IDS].sort());
  });

  it('marks exactly the "sound-" ids with "sound"', () => {
    expect(idsWithOverlay("sound")).toEqual(
      Object.keys(SHOWCASES)
        .filter((id) => id.startsWith("sound-"))
        .sort(),
    );
  });
});
