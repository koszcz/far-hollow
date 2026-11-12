import { describe, expect, it } from "bun:test";
import { isBetweenCameraAndPlayer, wallEnds } from "./edge-piece-meshes";

describe("fading walls between the camera and the player", () => {
  // A wall facing the default way, along x, on the line z = 0, with its deck at height 0.
  const wall = { x: 0, y: 0, z: 0 };
  const player = { x: 0, y: 0, z: -1 };

  it("fades a wall the camera looks through to see the player", () => {
    expect(isBetweenCameraAndPlayer(wall, 0, { x: 0, y: 4, z: 6 }, player)).toBe(true);
  });

  it("keeps a wall behind the player, or beside the line of sight, solid", () => {
    // The camera is on the player's side, so the wall is behind them.
    expect(isBetweenCameraAndPlayer(wall, 0, { x: 0, y: 4, z: -7 }, player)).toBe(false);
    // The line of sight passes well clear of the wall's end.
    expect(isBetweenCameraAndPlayer(wall, 0, { x: 6, y: 4, z: 6 }, { x: 4, y: 0, z: -1 })).toBe(false);
  });

  it("keeps a wall the camera looks down over solid", () => {
    expect(isBetweenCameraAndPlayer(wall, 0, { x: 0, y: 30, z: 2 }, { x: 0, y: 0, z: -6 })).toBe(false);
  });

  it("fades a wall that runs along z the same way", () => {
    expect(isBetweenCameraAndPlayer(wall, 1, { x: 6, y: 4, z: 0 }, { x: -1, y: 0, z: 0 })).toBe(true);
    expect(isBetweenCameraAndPlayer(wall, 1, { x: 0, y: 4, z: 6 }, { x: 0, y: 0, z: -1 })).toBe(false);
  });
});

describe("log wall corners", () => {
  // A wall on the +z edge of the square at the origin runs along x, from x = -0.5 to x = 0.5.
  const front = { middle: { x: 0, z: 0.5 }, turns: 0 };

  it("reaches past an end where a wall running the other way meets it", () => {
    const side = { middle: { x: 0.5, z: 0 }, turns: 3 };
    expect(wallEnds(front, [front, side])).toEqual({ start: false, end: true });
  });

  it("reaches past both ends between two side walls", () => {
    const left = { middle: { x: -0.5, z: 0 }, turns: 1 };
    const right = { middle: { x: 0.5, z: 1 }, turns: 3 };
    expect(wallEnds(front, [left, right])).toEqual({ start: true, end: true });
  });

  it("stays short where a wall carries on in a straight line", () => {
    const next = { middle: { x: 1, z: 0.5 }, turns: 0 };
    expect(wallEnds(front, [front, next])).toEqual({ start: false, end: false });
  });

  it("stays short where no wall meets it", () => {
    expect(wallEnds(front, [front])).toEqual({ start: false, end: false });
  });
});
