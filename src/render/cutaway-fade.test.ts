import { describe, expect, it } from "bun:test";
import type { Entity } from "../sim/entities";
import { createCutawayFades, CUTAWAY_FADE_SECONDS, cutawayOpacity } from "./cutaway-fade";
import { FADED_OPACITY } from "./structure-look";

const wall: Entity = { edgePiece: "logWall" };

describe("the cutaway fade", () => {
  it("starts at its target the first time a piece is seen, so a game that loads with the player inside shows no fade", () => {
    expect(createCutawayFades().level(wall, true, 10)).toBe(1);
    expect(createCutawayFades().level(wall, false, 10)).toBe(0);
  });

  it("eases a piece out over the fade time, and back in the same way", () => {
    const fades = createCutawayFades();
    fades.level(wall, false, 0);

    const halfway = fades.level(wall, true, CUTAWAY_FADE_SECONDS / 2);
    expect(halfway).toBeCloseTo(0.5, 5);
    const nearlyOut = fades.level(wall, true, CUTAWAY_FADE_SECONDS * 0.9);
    expect(nearlyOut).toBeGreaterThan(halfway);
    expect(nearlyOut).toBeLessThan(1);
    expect(fades.level(wall, true, CUTAWAY_FADE_SECONDS)).toBe(1);

    expect(fades.level(wall, false, CUTAWAY_FADE_SECONDS * 1.5)).toBeCloseTo(0.5, 5);
    expect(fades.level(wall, false, CUTAWAY_FADE_SECONDS * 2)).toBe(0);
  });

  it("jumps to its target without a time, as in a still showcase", () => {
    const fades = createCutawayFades();
    fades.level(wall, false, 0);
    expect(fades.level(wall, true)).toBe(1);
  });

  it("starts afresh for a piece it has forgotten", () => {
    const fades = createCutawayFades();
    fades.level(wall, false, 0);
    fades.forget(wall);
    expect(fades.level(wall, true, 0.01)).toBe(1);
  });

  it("makes a piece solid at level 0 and as see-through as a faded wall at level 1", () => {
    expect(cutawayOpacity(0)).toBe(1);
    expect(cutawayOpacity(1)).toBeCloseTo(FADED_OPACITY, 10);
  });
});
