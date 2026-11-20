import { describe, expect, it } from "bun:test";
import { addGroundPoints, copyToward, groundDistance, headingToward, nearestWithin, scaleGroundPoint, subtractGroundPoints } from "./ground-point";

describe("addGroundPoints", () => {
  it("adds the x parts and the z parts", () => {
    expect(addGroundPoints({ x: 1, z: -2 }, { x: 3.5, z: 4 })).toEqual({ x: 4.5, z: 2 });
  });
});

describe("subtractGroundPoints", () => {
  it("gives the step that leads from the second spot to the first", () => {
    expect(subtractGroundPoints({ x: 5, z: 1 }, { x: 2, z: 4 })).toEqual({ x: 3, z: -3 });
  });
});

describe("scaleGroundPoint", () => {
  it("multiplies both parts by the number", () => {
    expect(scaleGroundPoint({ x: 2, z: -3 }, 1.5)).toEqual({ x: 3, z: -4.5 });
  });

  it("flips the step when the number is negative", () => {
    expect(scaleGroundPoint({ x: 2, z: -3 }, -1)).toEqual({ x: -2, z: 3 });
  });
});

describe("groundDistance", () => {
  it("measures the straight line between two spots", () => {
    expect(groundDistance({ x: 1, z: 1 }, { x: 4, z: 5 })).toBe(5);
    expect(groundDistance({ x: 4, z: 5 }, { x: 1, z: 1 })).toBe(5);
    expect(groundDistance({ x: 2, z: 2 }, { x: 2, z: 2 })).toBe(0);
  });
});

describe("headingToward", () => {
  it("is 0 straight along +z, a quarter turn along +x, and a half turn along -z", () => {
    expect(headingToward({ x: 1, z: 1 }, { x: 1, z: 5 })).toBeCloseTo(0, 9);
    expect(headingToward({ x: 1, z: 1 }, { x: 4, z: 1 })).toBeCloseTo(Math.PI / 2, 9);
    expect(Math.abs(headingToward({ x: 1, z: 1 }, { x: 1, z: -3 }))).toBeCloseTo(Math.PI, 9);
  });
});

describe("copyToward", () => {
  it("gives a copy of the spot, or no field at all", () => {
    const spot = { x: 2, z: -3 };
    const copied = copyToward(spot);

    expect(copied).toEqual({ toward: { x: 2, z: -3 } });
    expect(copied.toward).not.toBe(spot);
    expect(copyToward(undefined)).toEqual({});
    expect("toward" in copyToward(undefined)).toBe(false);
  });
});

describe("nearestWithin", () => {
  const near = { name: "near", position: { x: 1, z: 0 } };
  const far = { name: "far", position: { x: 0, z: 3 } };

  it("picks the nearest candidate in reach", () => {
    expect(nearestWithin({ x: 0, z: 0 }, [far, near], 5)).toBe(near);
  });

  it("counts a candidate exactly at the edge of reach", () => {
    expect(nearestWithin({ x: 0, z: 0 }, [far], 3)).toBe(far);
  });

  it("gives nothing when every candidate is out of reach", () => {
    expect(nearestWithin({ x: 0, z: 0 }, [far, near], 0.5)).toBeUndefined();
  });
});
