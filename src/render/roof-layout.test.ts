import { describe, expect, it } from "bun:test";
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
  it("never makes a hip, even where every outside wall has a slope down to it", () => {
    // A 3 by 2 cabin: the front row slopes to +z, the back row to -z, and the ends slope out.
    const sloping = [section(0, 0, 0), section(0, -1, 2), section(1, 0, 3), section(1, -1, 3), section(-1, 0, 1), section(-1, -1, 1)];
    const places = roofPlaces(sloping);

    expect(sloping.map((one) => placeOf(places, one).shape)).toEqual(["straight", "straight", "straight", "straight", "straight", "straight"]);
  });

  /**
   * An L of two wings, each two squares deep. Wing A runs along x over columns 0 to 3 and rows -1 and 0, with a ridge between
   * its rows. Wing B runs along z from A's front, over columns 2 and 3 and rows 1 and 2, with a ridge between its columns.
   * The four corner squares, columns 2 and 3 and rows -1 and 0, slope like `corner` says.
   */
  function lShaped(corner: "likeA" | "likeB") {
    const wingA = [0, 1].flatMap((x) => [section(x, -1, 2), section(x, 0, 0)]);
    const wingB = [1, 2].flatMap((z) => [section(2, z, 1), section(3, z, 3)]);
    const corners = {
      leftBack: section(2, -1, corner === "likeA" ? 2 : 1),
      leftFront: section(2, 0, corner === "likeA" ? 0 : 1),
      rightBack: section(3, -1, corner === "likeA" ? 2 : 3),
      rightFront: section(3, 0, corner === "likeA" ? 0 : 3),
    };
    return { wingA, wingB, corners, all: [...wingA, ...wingB, ...Object.values(corners)] };
  }

  it("lets wing A run through where the corner slopes like A, and ends wing B against it in valleys", () => {
    const { wingB, corners, all } = lShaped("likeA");
    const places = roofPlaces(all);

    // The valleys lie on A's front slope, where B's roof meets it.
    expect(placeOf(places, corners.leftFront)).toMatchObject({ shape: "valley", drawTurns: 1 });
    expect(placeOf(places, corners.rightFront)).toMatchObject({ shape: "valley", drawTurns: 0 });
    // A's back slope and its ridge carry on to the outer end, where a gable end closes it.
    expect(placeOf(places, corners.leftBack).shape).toBe("straight");
    expect(placeOf(places, corners.rightBack).shape).toBe("straight");
    expect(wingB.map((one) => placeOf(places, one).shape)).toEqual(["straight", "straight", "straight", "straight"]);
  });

  it("lets wing B run through where the corner slopes like B, and ends wing A against it in valleys", () => {
    const { wingA, corners, all } = lShaped("likeB");
    const places = roofPlaces(all);

    // The valleys lie on B's left slope, where A's roof meets it.
    expect(placeOf(places, corners.leftFront)).toMatchObject({ shape: "valley" });
    expect(placeOf(places, corners.leftBack)).toMatchObject({ shape: "valley" });
    expect(placeOf(places, corners.rightFront).shape).toBe("straight");
    expect(placeOf(places, corners.rightBack).shape).toBe("straight");
    expect(wingA.map((one) => placeOf(places, one).shape)).toEqual(["straight", "straight", "straight", "straight"]);
  });

  it("lines the valleys up with every section round them, with no step, whichever wing runs through", () => {
    for (const corner of ["likeA", "likeB"] as const) {
      const { corners, all } = lShaped(corner);
      const places = roofPlaces(all);
      const at = (x: number, z: number) => all.find((one) => one.position.x === x + 0.5 && one.position.z === z + 0.5) ?? corners.leftFront;

      for (const [a, b] of [
        [at(2, 0), at(2, 1)],
        [at(3, 0), at(3, 1)],
        [at(1, 0), at(2, 0)],
        [at(1, -1), at(2, -1)],
        [at(2, 0), at(3, 0)],
        [at(2, -1), at(3, -1)],
        [at(2, -1), at(2, 0)],
        [at(3, -1), at(3, 0)],
      ] as const) {
        expect(meetAlongEdge(places, a, b)).toBe(true);
      }
    }
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

  it("reshapes a valley when the roof beside it is taken down", () => {
    const { corners, all } = lShaped("likeA");
    const withoutWingB = all.filter((one) => one.position.z < 1);

    expect(placeOf(roofPlaces(all), corners.leftFront).shape).toBe("valley");
    expect(placeOf(roofPlaces(withoutWingB), corners.leftFront).shape).toBe("straight");
  });
});

describe("a taller butted wing", () => {
  // Wing A, two squares deep, runs through along x over rows -1 and 0. Wing B, four squares wide over columns 0 to 3,
  // butts against A's front, so its ridge rises two rises, above A's ridge at one.
  const through = [0, 1, 2, 3].flatMap((x) => [section(x, -1, 2), section(x, 0, 0)]);
  const butted = [0, 1, 2, 3].map((x) => section(x, 1, x < 2 ? 1 : 3));
  const places = roofPlaces([...through, ...butted]);
  const front = (x: number) => through.find((one) => one.position.x === x + 0.5 && one.turns === 0) ?? section(0, 0, 0);
  const back = (x: number) => through.find((one) => one.position.x === x + 0.5 && one.turns === 2) ?? section(0, 0, 0);

  it("ends in valleys at its outer corners, runs its taller slopes over the middle, and lines up with every section round it", () => {
    expect([0, 1, 2, 3].map((x) => placeOf(places, front(x)))).toMatchObject([
      { shape: "valley" },
      // B's slopes down to -x and +x, a rise up from their walls, carried on over A's front row.
      { shape: "straight", drawTurns: 1, inFront: 1 },
      { shape: "straight", drawTurns: 3, inFront: 1 },
      { shape: "valley" },
    ]);
    for (const x of [0, 1, 2, 3]) expect(meetAlongEdge(places, front(x), butted[x] ?? front(x))).toBe(true);
    for (const x of [0, 1, 2]) expect(meetAlongEdge(places, front(x), front(x + 1))).toBe(true);
  });

  it("stands above the through-roof's ridge, leaving a step for a gable end to fill", () => {
    // Where B's ridge meets A's ridge, between columns 1 and 2.
    const ridge = { x: 2, z: 0 };

    expect(roofTopAt(placeOf(places, front(1)), front(1).position, ridge)).toBeCloseTo(2, 9);
    expect(roofTopAt(placeOf(places, back(1)), back(1).position, ridge)).toBeCloseTo(1, 9);
  });
});

describe("wings deeper than two squares", () => {
  // Wing A, four squares deep, runs through along x over columns 0 to 5: rows -1 and 0 slope to +z, rows -3 and -2 to -z.
  // Wing B, four squares wide over columns 2 to 5, butts against A's front, so both ridges rise two rises.
  const through = [0, 1, 2, 3, 4, 5].flatMap((x) => [section(x, -3, 2), section(x, -2, 2), section(x, -1, 0), section(x, 0, 0)]);
  const butted = [2, 3, 4, 5].flatMap((x) => [section(x, 1, x < 4 ? 1 : 3), section(x, 2, x < 4 ? 1 : 3)]);
  const all = [...through, ...butted];
  const places = roofPlaces(all);
  const at = (x: number, z: number) => all.find((one) => one.position.x === x + 0.5 && one.position.z === z + 0.5) ?? section(0, 0, 0);
  const has = (x: number, z: number) => all.some((one) => one.position.x === x + 0.5 && one.position.z === z + 0.5);

  it("end in valleys that run on up to the ridges, two squares deep", () => {
    expect([2, 3, 4, 5].map((x) => placeOf(places, at(x, 0)).shape)).toEqual(["valley", "straight", "straight", "valley"]);
    expect([2, 3, 4, 5].map((x) => placeOf(places, at(x, -1)).shape)).toEqual(["straight", "valley", "valley", "straight"]);
  });

  it("line the valleys up with every section round them, with no step", () => {
    for (const x of [1, 2, 3, 4, 5]) {
      for (const z of [-2, -1, 0, 1]) {
        if (has(x, z) && has(x + 1, z)) expect(meetAlongEdge(places, at(x, z), at(x + 1, z))).toBe(true);
        if (has(x, z) && has(x, z + 1)) expect(meetAlongEdge(places, at(x, z), at(x, z + 1))).toBe(true);
      }
    }
  });
});

describe("a shed roof", () => {
  it("is one slope with no ridge where every frame in a run faces the same way", () => {
    const shed = [0, 1].flatMap((x) => [section(x, -1, 0), section(x, 0, 0)]);
    const places = roofPlaces(shed);

    expect(shed.map((one) => placeOf(places, one))).toMatchObject([
      { shape: "straight", inFront: 1 },
      { shape: "straight", inFront: 0 },
      { shape: "straight", inFront: 1 },
      { shape: "straight", inFront: 0 },
    ]);
    expect(meetAlongEdge(places, shed[0] ?? section(0, 0, 0), shed[1] ?? section(0, 0, 0))).toBe(true);
  });
});

describe("roof lift across the slope", () => {
  it("lifts sections in odd columns across their slope, so bark side by side does not flicker", () => {
    const sloping = [section(0, 0, 0), section(1, 0, 0), section(5, 1, 3), section(5, 2, 3)];
    const places = roofPlaces(sloping);

    expect(sloping.map((one) => placeOf(places, one).lifted)).toEqual([false, true, true, false]);
  });
});
