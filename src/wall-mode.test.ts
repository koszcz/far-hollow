import { describe, expect, it } from "bun:test";
import { fadesCabinSide, hidesRoofs, nextWallMode, STARTING_WALL_MODE } from "./wall-mode";

describe("the wall mode", () => {
  it("starts in cutaway", () => {
    expect(STARTING_WALL_MODE).toBe("cutaway");
  });

  it("steps from walls up to cutaway to walls down, and back to walls up", () => {
    expect(nextWallMode("wallsUp")).toBe("cutaway");
    expect(nextWallMode("cutaway")).toBe("wallsDown");
    expect(nextWallMode("wallsDown")).toBe("wallsUp");
  });

  it("hides roofs in cutaway and walls down, not in walls up", () => {
    expect(hidesRoofs("wallsUp")).toBe(false);
    expect(hidesRoofs("cutaway")).toBe(true);
    expect(hidesRoofs("wallsDown")).toBe(true);
  });

  it("fades no side in walls up, the sides facing the camera in cutaway, and every side in walls down", () => {
    expect(fadesCabinSide("wallsUp", true)).toBe(false);
    expect(fadesCabinSide("wallsUp", false)).toBe(false);
    expect(fadesCabinSide("cutaway", true)).toBe(true);
    expect(fadesCabinSide("cutaway", false)).toBe(false);
    expect(fadesCabinSide("wallsDown", true)).toBe(true);
    expect(fadesCabinSide("wallsDown", false)).toBe(true);
  });
});
