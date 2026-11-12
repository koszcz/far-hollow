import { describe, expect, it } from "bun:test";
import type { BuildMenuEntry } from "../sim/api";
import { placingHint } from "./placing-hint";

const MENU: readonly BuildMenuEntry[] = [
  { structure: "campfire", cost: [{ material: "stick", count: 5 }], placement: "onGround" },
  { structure: "roof", cost: [{ material: "bark", count: 4 }], placement: "onFrame" },
];

describe("the placing hint", () => {
  it("says what to click, then names the rotate and cancel keys", () => {
    expect(placingHint(MENU, "campfire")).toEqual({
      what: "Placing: Campfire. Click the ground to place it.",
      keys: "R to rotate · Esc to cancel",
    });
  });

  it("names only the cancel key for a roof section, which cannot turn", () => {
    expect(placingHint(MENU, "roof").keys).toBe("Esc to cancel");
  });
});
