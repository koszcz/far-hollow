import { describe, expect, it } from "vitest";
import { mainActionFor } from "./walk-input";

describe("clicking a campfire", () => {
  it("walks the player over to tend it", () => {
    expect(mainActionFor({ kind: "campfire", id: 7 })).toEqual({ type: "tendCampfire", campfireId: 7 });
  });
});
