import { describe, expect, it } from "bun:test";
import { extendTrail, pullAlongTrail } from "./drag-trail";

const seesAll = () => true;

describe("the trail a dragged sled follows", () => {
  it("adds the player's spot once they have walked a little way from the newest one", () => {
    const trail = extendTrail([], { x: 0, z: 0 });
    expect(trail).toEqual([{ x: 0, z: 0 }]);
    expect(extendTrail(trail, { x: 0.05, z: 0 })).toBe(trail);
    expect(extendTrail(trail, { x: 0.2, z: 0 })).toEqual([
      { x: 0, z: 0 },
      { x: 0.2, z: 0 },
    ]);
  });

  it("leaves the sled where it is while the rope is slack", () => {
    const dragged = pullAlongTrail({ x: 0, z: 0 }, { x: 1, z: 0 }, [], 1.5, seesAll);
    expect(dragged.sled).toEqual({ x: 0, z: 0 });
    expect(dragged.pull).toBeUndefined();
  });

  it("on open ground, pulls the sled straight towards the player until it is a rope's length behind", () => {
    const dragged = pullAlongTrail({ x: 0, z: 0 }, { x: 0, z: 3 }, [{ x: 2, z: 1 }], 1, seesAll);
    expect(dragged.sled.x).toBeCloseTo(0, 6);
    expect(dragged.sled.z).toBeCloseTo(2, 6);
    expect(dragged.pull).toEqual({ x: 0, z: 1 });
    expect(dragged.trail).toEqual([]);
  });

  it("round a corner it cannot see past, follows the trail to the corner, then on towards the player", () => {
    const corner = { x: 0, z: 2 };
    // The sled at the start sees only the corner. From the corner, it sees the player.
    const canSee = (from: { x: number; z: number }, to: { x: number; z: number }) => from.z >= 2 || to.x === 0;
    const dragged = pullAlongTrail({ x: 0, z: 0 }, { x: 3, z: 2 }, [corner], 2, canSee);

    expect(dragged.sled.x).toBeCloseTo(1, 6);
    expect(dragged.sled.z).toBeCloseTo(2, 6);
    expect(dragged.pull).toEqual({ x: 1, z: 0 });
    expect(dragged.trail).toEqual([]);
  });

  it("keeps the trail spots past the furthest one it can see", () => {
    const canSee = (_from: { x: number; z: number }, to: { x: number; z: number }) => to.z <= 2;
    const dragged = pullAlongTrail(
      { x: 0, z: 0 },
      { x: 3, z: 3 },
      [
        { x: 0, z: 1 },
        { x: 0, z: 2 },
        { x: 1, z: 3 },
      ],
      4,
      canSee,
    );

    expect(dragged.sled.z).toBeCloseTo(1.414, 2);
    expect(dragged.trail).toEqual([
      { x: 0, z: 2 },
      { x: 1, z: 3 },
    ]);
  });
});
