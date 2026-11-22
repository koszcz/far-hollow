import { describe, expect, it } from "bun:test";
import { distanceFade, listenerFrom, panToward, SILENT_AT_METRES } from "./listener";

/** A listener at the valley's centre, with the camera looking along +z. The screen's right is then -x. */
const FACING_PLUS_Z = listenerFrom({ x: 0, z: 0 }, { eye: { x: 0, z: -10 }, focus: { x: 0, z: 0 } });

describe("distance fade", () => {
  it("is full loudness at the player's spot", () => {
    expect(distanceFade(FACING_PLUS_Z, { x: 0, z: 0 })).toBe(1);
  });

  it("is silent from about 30 m on", () => {
    expect(SILENT_AT_METRES).toBe(30);
    expect(distanceFade(FACING_PLUS_Z, { x: 30, z: 0 })).toBe(0);
    expect(distanceFade(FACING_PLUS_Z, { x: 0, z: -45 })).toBe(0);
  });

  it("gets quieter the farther the sound is", () => {
    const near = distanceFade(FACING_PLUS_Z, { x: 5, z: 0 });
    const middle = distanceFade(FACING_PLUS_Z, { x: 15, z: 0 });
    const far = distanceFade(FACING_PLUS_Z, { x: 25, z: 0 });
    expect(near).toBeLessThan(1);
    expect(middle).toBeLessThan(near);
    expect(far).toBeLessThan(middle);
    expect(far).toBeGreaterThan(0);
  });

  it("drops faster close in than far out, so halfway sounds well under half as loud", () => {
    expect(distanceFade(FACING_PLUS_Z, { x: 15, z: 0 })).toBeLessThan(0.35);
  });
});

describe("panning", () => {
  it("is in the middle for a sound straight ahead or straight behind", () => {
    expect(panToward(FACING_PLUS_Z, { x: 0, z: 10 })).toBeCloseTo(0);
    expect(panToward(FACING_PLUS_Z, { x: 0, z: -10 })).toBeCloseTo(0);
  });

  it("is fully right for a sound to the right of the camera's view, and fully left for one to its left", () => {
    expect(panToward(FACING_PLUS_Z, { x: -10, z: 0 })).toBeCloseTo(1);
    expect(panToward(FACING_PLUS_Z, { x: 10, z: 0 })).toBeCloseTo(-1);
  });

  it("is partly right for a sound ahead and to the right", () => {
    const pan = panToward(FACING_PLUS_Z, { x: -10, z: 10 });
    expect(pan).toBeGreaterThan(0.5);
    expect(pan).toBeLessThan(0.8);
  });

  it("turns with the camera", () => {
    // Looking along +x, the screen's right is +z.
    const facingPlusX = listenerFrom({ x: 0, z: 0 }, { eye: { x: -10, z: 0 }, focus: { x: 0, z: 0 } });
    expect(panToward(facingPlusX, { x: 0, z: 10 })).toBeCloseTo(1);
  });

  it("is in the middle for a sound at the player's spot", () => {
    expect(panToward(FACING_PLUS_Z, { x: 0, z: 0 })).toBe(0);
  });
});
