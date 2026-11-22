import { describe, expect, it } from "bun:test";
import { CAMPFIRE_FUEL_LIMIT_MINUTES } from "../sim/campfires";
import { flameSize, FLAME_FULL_SIZE_FUEL_MINUTES } from "./flame-size";

describe("flame size", () => {
  it("is nothing while the fire is out, whatever fuel it holds", () => {
    expect(flameSize("campfire", { lit: false, fuelMinutes: 200 })).toBe(0);
  });

  it("is full once a lit fire holds a quarter of its fuel limit", () => {
    expect(FLAME_FULL_SIZE_FUEL_MINUTES.campfire).toBe(CAMPFIRE_FUEL_LIMIT_MINUTES / 4);
    expect(flameSize("campfire", { lit: true, fuelMinutes: CAMPFIRE_FUEL_LIMIT_MINUTES / 4 })).toBe(1);
    expect(flameSize("campfire", { lit: true, fuelMinutes: CAMPFIRE_FUEL_LIMIT_MINUTES })).toBe(1);
  });

  it("shrinks to about a third as the fuel runs out", () => {
    expect(flameSize("campfire", { lit: true, fuelMinutes: 0 })).toBeCloseTo(0.35);
    expect(flameSize("fireplace", { lit: true, fuelMinutes: FLAME_FULL_SIZE_FUEL_MINUTES.fireplace / 2 })).toBeCloseTo(0.675);
  });
});
