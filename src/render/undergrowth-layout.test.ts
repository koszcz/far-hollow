import { describe, expect, it } from "vitest";
import { createGroundMap } from "../sim/ground-types";
import type { GroundPoint, River } from "../sim/valley";
import { growUndergrowthPatch, UNDERGROWTH_PATCH_METRES, type UndergrowthPlant } from "./undergrowth-layout";

/** A straight river along x = 0, 8 m wide, so its water ends 4 m from its middle. */
const straightRiver: River = {
  path: [
    { x: 0, z: -500 },
    { x: 0, z: 500 },
  ],
  width: 8,
};

function mapWith(trees: readonly GroundPoint[]) {
  return createGroundMap({ size: 1000, river: straightRiver, trees });
}

/** A grid of trees 2 m apart covering a square, so all the ground inside is forest floor. */
function forestAround(centre: GroundPoint, halfWidth: number): GroundPoint[] {
  const trees: GroundPoint[] = [];
  for (let x = centre.x - halfWidth; x <= centre.x + halfWidth; x += 2) {
    for (let z = centre.z - halfWidth; z <= centre.z + halfWidth; z += 2) trees.push({ x, z });
  }
  return trees;
}

/** The patch that holds a spot. Patches are counted from the valley's edge at x = -500, z = -500. */
function patchAt(spot: GroundPoint): { column: number; row: number } {
  return { column: Math.floor((spot.x + 500) / UNDERGROWTH_PATCH_METRES), row: Math.floor((spot.z + 500) / UNDERGROWTH_PATCH_METRES) };
}

/** Grows a square of patches around a spot, so each test sees plenty of plants. */
function growAround(seed: number, map: ReturnType<typeof mapWith>, spot: GroundPoint, patches = 3): UndergrowthPlant[] {
  const { column, row } = patchAt(spot);
  const plants: UndergrowthPlant[] = [];
  for (let r = row - 1; r < row - 1 + patches; r += 1) {
    for (let c = column - 1; c < column - 1 + patches; c += 1) plants.push(...growUndergrowthPatch(seed, map, c, r));
  }
  return plants;
}

function kindsOf(plants: readonly UndergrowthPlant[]): string[] {
  return [...new Set(plants.map((plant) => plant.kind))].sort();
}

describe("growUndergrowthPatch", () => {
  it("grows ferns, small rocks, and sparse grass on the forest floor", () => {
    const centre = { x: 200, z: 100 };
    const map = mapWith(forestAround(centre, 30));
    const plants = growAround(7, map, centre);
    expect(kindsOf(plants)).toEqual(["fern", "smallRock", "sparseGrass"]);
  });

  it("grows grass tufts, flowers, and rare stones in a clearing", () => {
    const map = mapWith([]);
    const plants = growAround(7, map, { x: 200, z: 100 }, 6);
    expect(kindsOf(plants)).toEqual(["flower", "grassTuft", "stone"]);
    const stones = plants.filter((plant) => plant.kind === "stone").length;
    const tufts = plants.filter((plant) => plant.kind === "grassTuft").length;
    expect(stones * 10).toBeLessThan(tufts);
  });

  it("grows tall grass and flat pebbles on the river bank", () => {
    const map = mapWith([]);
    const plants = growAround(7, map, { x: 8, z: 100 }, 6).filter((plant) => Math.abs(plant.x) >= 5 && Math.abs(plant.x) <= 9);
    expect(plants.length).toBeGreaterThan(0);
    expect(kindsOf(plants)).toEqual(["flatPebble", "tallGrass"]);
  });

  it("grows nothing in the river's water", () => {
    const map = mapWith([]);
    const plants = growAround(7, map, { x: 0, z: 100 }, 6);
    expect(plants.filter((plant) => Math.abs(plant.x) < 4)).toEqual([]);
  });

  it("grows the same undergrowth in the same spots for the same seed", () => {
    const map = mapWith(forestAround({ x: -100, z: -60 }, 20));
    const spot = { x: -100, z: -80 };
    expect(growAround(42, map, spot, 6)).toEqual(growAround(42, mapWith(forestAround({ x: -100, z: -60 }, 20)), spot, 6));
  });

  it("grows different spots for a different seed", () => {
    const map = mapWith([]);
    const spot = { x: 200, z: 100 };
    expect(growAround(1, map, spot).map((plant) => plant.x)).not.toEqual(growAround(2, map, spot).map((plant) => plant.x));
  });
});
