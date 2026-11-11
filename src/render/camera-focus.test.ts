import { describe, expect, it } from "vitest";
import { createCameraFocus } from "./camera-focus";

describe("camera focus", () => {
  it("follows the player by default", () => {
    const focus = createCameraFocus();
    focus.update({ x: 3, y: 1, z: -4 });
    expect(focus.point).toEqual({ x: 3, y: 1, z: -4 });
    focus.update({ x: 5, y: 2, z: -6 });
    expect(focus.point).toEqual({ x: 5, y: 2, z: -6 });
  });

  it("stays put when follow is off, until snapped back to the player", () => {
    const focus = createCameraFocus({ follow: false, start: { x: 0, y: 0, z: 0 } });
    focus.update({ x: 3, y: 1, z: -4 });
    expect(focus.point).toEqual({ x: 0, y: 0, z: 0 });

    focus.snapToPlayer();
    focus.update({ x: 3, y: 1, z: -4 });
    expect(focus.point).toEqual({ x: 3, y: 1, z: -4 });

    focus.update({ x: 9, y: 1, z: 9 });
    expect(focus.point).toEqual({ x: 3, y: 1, z: -4 });
  });
});
