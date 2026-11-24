import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { ANIMATIONS_SHOWCASES } from "./animations";

/** The animation showcases that existed before each one moved into its own file. */
const KEYS_BEFORE_THE_SPLIT = [
  "sled-drag-animation",
  "sled-rope",
  "campfire-build-animation",
  "chop-animation",
  "player-build-animation",
  "pick-up-animation",
  "walk-animation",
  "sleep-animation",
  "sit-animation",
  "debarking-animation",
  "gather-stone-animation",
  "sawing-animation",
  "hand-craft-animation",
  "fishing-animation",
  "forage-eat-drink-animation",
  "split-animation",
];

describe("animation showcases", () => {
  it("keeps every showcase that existed before the split", () => {
    // Showcases added since the split, such as the "carry-in-hands-animation", may join them.
    const keys = Object.keys(ANIMATIONS_SHOWCASES);
    for (const key of KEYS_BEFORE_THE_SPLIT) expect(keys).toContain(key);
  });

  it("builds each showcase in a file named after its asset id", async () => {
    for (const id of Object.keys(ANIMATIONS_SHOWCASES)) {
      const module = (await import(`./animations/${id}`)) as Record<string, unknown>;
      expect(Object.values(module)).toContain(ANIMATIONS_SHOWCASES[id]);
    }
  });

  it("lets git merge the registry by union, so two new showcases do not conflict", () => {
    const attributes = readFileSync(join(import.meta.dirname, "../../../.gitattributes"), "utf8");
    expect(attributes).toMatch(/^src\/render\/showcases\/animations\/registry\.ts\s+merge=union$/m);
  });
});
