import { describe, expect, it } from "bun:test";
import {
  addGroundPoints,
  blendGroundPoints,
  copyToward,
  groundDistance,
  headingToward,
  nearestWithin,
  randomPointAround,
  scaleGroundPoint,
  stepAlongHeading,
  subtractGroundPoints,
} from "./ground-point";
import { createRandom } from "./random";

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

describe("stepAlongHeading", () => {
  it("steps toward +z at heading 0 and toward +x at a quarter turn", () => {
    expect(stepAlongHeading({ x: 1, z: 2 }, 0, 3)).toEqual({ x: 1, z: 5 });
    const quarter = stepAlongHeading({ x: 1, z: 2 }, Math.PI / 2, 3);
    expect(quarter.x).toBeCloseTo(4);
    expect(quarter.z).toBeCloseTo(2);
  });

  it("steps backward for a negative distance", () => {
    expect(stepAlongHeading({ x: 0, z: 0 }, 0, -2)).toEqual({ x: 0, z: -2 });
  });
});

describe("blendGroundPoints", () => {
  it("gives the start at 0, the end at 1, and the spot that share of the way between", () => {
    const a = { x: 1, z: 2 };
    const b = { x: 5, z: -2 };
    expect(blendGroundPoints(a, b, 0)).toEqual(a);
    expect(blendGroundPoints(a, b, 1)).toEqual(b);
    expect(blendGroundPoints(a, b, 0.25)).toEqual({ x: 2, z: 1 });
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

describe("randomPointAround", () => {
  const centre = { x: 10, z: -5 };

  it("keeps every spot within the radius of the centre", () => {
    const random = createRandom(3);
    for (let i = 0; i < 1000; i += 1) expect(groundDistance(randomPointAround(centre, { max: 20 }, random), centre)).toBeLessThanOrEqual(20);
  });

  it("keeps every spot outside the inner radius when one is given", () => {
    const random = createRandom(4);
    for (let i = 0; i < 1000; i += 1) {
      const distance = groundDistance(randomPointAround(centre, { min: 8, max: 20 }, random), centre);
      expect(distance).toBeGreaterThanOrEqual(8);
      expect(distance).toBeLessThanOrEqual(20);
    }
  });

  it("spreads spots evenly by area, so a quarter fall within half the radius", () => {
    const random = createRandom(5);
    let inner = 0;
    const tries = 20_000;
    for (let i = 0; i < tries; i += 1) if (groundDistance(randomPointAround(centre, { max: 20 }, random), centre) < 10) inner += 1;
    expect(inner / tries).toBeGreaterThan(0.23);
    expect(inner / tries).toBeLessThan(0.27);
  });
});
