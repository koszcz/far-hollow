import { describe, expect, it } from "vitest";
import type { QuarterTurns } from "../sim/structure-kind";
import { roofPlaces, roofTopAt, type RoofPlace, type RoofSection } from "./roof-layout";

/** A roof section over the square with this middle. Turns 0 slopes down to +z, 1 to -x, 2 to -z, and 3 to +x. */
function section(x: number, z: number, turns: QuarterTurns): RoofSection {
  return { position: { x: x + 0.5, z: z + 0.5 }, turns };
}

function placeOf(places: Map<RoofSection, RoofPlace>, of: RoofSection): RoofPlace {
  const place = places.get(of);
  if (place === undefined) throw new Error("No place");
  return place;
}

/** Whether two sections' roofs reach the same height all along the edge they share. */
function meetAlongEdge(places: Map<RoofSection, RoofPlace>, a: RoofSection, b: RoofSection): boolean {
  const middle = { x: (a.position.x + b.position.x) / 2, z: (a.position.z + b.position.z) / 2 };
  const along = a.position.x === b.position.x ? { x: 1, z: 0 } : { x: 0, z: 1 };
  return [-0.5, -0.25, 0, 0.25, 0.5].every((t) => {
    const point = { x: middle.x + along.x * t, z: middle.z + along.z * t };
    return Math.abs(roofTopAt(placeOf(places, a), a.position, point) - roofTopAt(placeOf(places, b), b.position, point)) < 1e-9;
  });
}

describe("roof sections one behind another", () => {
  it("share one slope: each sits a rise higher for each section in front of it that slopes the same way", () => {
    const front = section(0, 1, 0);
    const middle = section(0, 0, 0);
    const back = section(0, -1, 0);
    const places = roofPlaces([front, middle, back]);

    expect([front, middle, back].map((one) => placeOf(places, one).inFront)).toEqual([0, 1, 2]);
    expect(meetAlongEdge(places, front, middle)).toBe(true);
    expect(meetAlongEdge(places, middle, back)).toBe(true);
  });

  it("rise from their own downhill wall when turned", () => {
    // Three sections in a row along x, all sloping down to -x.
    const low = section(-1, 0, 1);
    const middle = section(0, 0, 1);
    const high = section(1, 0, 1);
    const places = roofPlaces([low, middle, high]);

    expect([low, middle, high].map((one) => placeOf(places, one).inFront)).toEqual([0, 1, 2]);
    expect(placeOf(places, middle)).toMatchObject({ shape: "straight", drawTurns: 1 });
    expect(meetAlongEdge(places, low, middle)).toBe(true);
  });

  it("do not count a section in front that slopes another way", () => {
    // A ridge: the front section slopes to +z and the back one to -z. Both rise from their own wall and meet at the top.
    const front = section(0, 0, 0);
    const back = section(0, -1, 2);
    const places = roofPlaces([front, back]);

    expect(placeOf(places, front).inFront).toBe(0);
    expect(placeOf(places, back).inFront).toBe(0);
    expect(meetAlongEdge(places, front, back)).toBe(true);
  });
});

describe("roof corners", () => {
  // A 3 by 2 cabin with a hipped roof: the front row slopes to +z, the back row to -z, and the ends slope out.
  const hipped = {
    frontMiddle: section(0, 0, 0),
    backMiddle: section(0, -1, 2),
    frontRight: section(1, 0, 3),
    backRight: section(1, -1, 3),
    frontLeft: section(-1, 0, 1),
    backLeft: section(-1, -1, 1),
  };

  it("makes each outside corner a hip that slopes down both ways", () => {
    const places = roofPlaces(Object.values(hipped));

    expect(placeOf(places, hipped.frontMiddle).shape).toBe("straight");
    expect(placeOf(places, hipped.backMiddle).shape).toBe("straight");
    // Drawn unturned, a hip slopes down to +z and +x. Turns 3 makes that +x and -z, and so on.
    expect(placeOf(places, hipped.frontRight)).toMatchObject({ shape: "hip", drawTurns: 0, inFront: 0 });
    expect(placeOf(places, hipped.backRight)).toMatchObject({ shape: "hip", drawTurns: 3, inFront: 0 });
    expect(placeOf(places, hipped.frontLeft)).toMatchObject({ shape: "hip", drawTurns: 1, inFront: 0 });
    expect(placeOf(places, hipped.backLeft)).toMatchObject({ shape: "hip", drawTurns: 2, inFront: 0 });
  });

  it("lines the hips up with the slopes beside them, with no step", () => {
    const places = roofPlaces(Object.values(hipped));

    expect(meetAlongEdge(places, hipped.frontRight, hipped.frontMiddle)).toBe(true);
    expect(meetAlongEdge(places, hipped.frontRight, hipped.backRight)).toBe(true);
    expect(meetAlongEdge(places, hipped.backLeft, hipped.backMiddle)).toBe(true);
    expect(meetAlongEdge(places, hipped.frontMiddle, hipped.backMiddle)).toBe(true);
  });

  it("makes an inside corner a valley, and lines it up with both slopes", () => {
    // An L one square wide whose roofs slope into the L: the arm along x slopes to +z, the arm along z to +x.
    const corner = section(0, 0, 0);
    const alongX = section(1, 0, 0);
    const alongZ = section(0, 1, 3);
    const places = roofPlaces([corner, alongX, alongZ]);

    expect(placeOf(places, corner)).toMatchObject({ shape: "valley", drawTurns: 0, inFront: 0 });
    expect(placeOf(places, alongX).shape).toBe("straight");
    expect(placeOf(places, alongZ).shape).toBe("straight");
    expect(meetAlongEdge(places, corner, alongX)).toBe(true);
    expect(meetAlongEdge(places, corner, alongZ)).toBe(true);
  });

  it("gives the same corner whichever of its two ways the corner section was turned", () => {
    const alongX = section(1, 0, 0);
    const alongZ = section(0, 1, 3);
    const turnedOneWay = section(0, 0, 0);
    const turnedTheOther = section(0, 0, 3);

    expect(placeOf(roofPlaces([turnedOneWay, alongX, alongZ]), turnedOneWay)).toMatchObject({ shape: "valley", drawTurns: 0 });
    expect(placeOf(roofPlaces([turnedTheOther, alongX, alongZ]), turnedTheOther)).toMatchObject({ shape: "valley", drawTurns: 0 });
  });

  it("keeps a section straight where the run it belongs to carries on past the corner", () => {
    // The right column slopes to +x along two squares. Only the front one is at the end of the run, so only it is a hip.
    const back = section(1, -1, 3);
    const front = section(1, 0, 3);
    const places = roofPlaces([section(0, -1, 0), section(0, 0, 0), back, front]);

    expect(placeOf(places, back).shape).toBe("straight");
    expect(placeOf(places, front).shape).toBe("hip");
  });

  it("reshapes a corner when a roof beside it is taken down", () => {
    const withoutFrontMiddle = Object.values(hipped).filter((one) => one !== hipped.frontMiddle);

    expect(placeOf(roofPlaces(Object.values(hipped)), hipped.frontRight).shape).toBe("hip");
    expect(placeOf(roofPlaces(withoutFrontMiddle), hipped.frontRight).shape).toBe("straight");
  });
});

describe("roof lift across the slope", () => {
  it("lifts sections in odd columns across their slope, so bark side by side does not flicker", () => {
    const sloping = [section(0, 0, 0), section(1, 0, 0), section(5, 1, 3), section(5, 2, 3)];
    const places = roofPlaces(sloping);

    expect(sloping.map((one) => placeOf(places, one).lifted)).toEqual([false, true, true, false]);
  });
});
