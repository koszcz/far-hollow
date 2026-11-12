import { describe, expect, it } from "bun:test";
import { SEE_THROUGH_OUTER_METRES, seeThroughAmount } from "./tree-see-through";

const eye = { x: 0, y: 30, z: 40 };
const player = { x: 0, y: 0, z: 0 };

describe("tree see-through", () => {
  it("fades a tree standing on the line between the camera and the player", () => {
    expect(seeThroughAmount({ x: 0, y: 0, z: 20 }, eye, player)).toBe(1);
  });

  it("leaves a tree well to the side of that line solid", () => {
    expect(seeThroughAmount({ x: SEE_THROUGH_OUTER_METRES + 1, y: 0, z: 20 }, eye, player)).toBe(0);
  });

  it("fades a tree partly as it nears the line", () => {
    const amount = seeThroughAmount({ x: 3.5, y: 0, z: 20 }, eye, player);
    expect(amount).toBeGreaterThan(0);
    expect(amount).toBeLessThan(1);
  });

  it("leaves a tree far beyond the player solid", () => {
    expect(seeThroughAmount({ x: 0, y: 0, z: -20 }, eye, player)).toBe(0);
  });

  it("fades a tree right next to the player, whichever side it stands", () => {
    expect(seeThroughAmount({ x: 0, y: 0, z: -1 }, eye, player)).toBe(1);
  });
});
