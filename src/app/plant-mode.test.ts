import { describe, expect, it } from "bun:test";
import type { Command } from "../sim/api-commands";
import type { Refusal } from "../sim/api-refusal";
import { plantCommandFor, plantUnderMouse, pressPlantKey } from "./plant-mode";

/** A game that refuses planting at x below 0, and records what it was asked about. */
function clientRefusingWest() {
  const asked: Command[] = [];
  return {
    asked,
    refusal(command: Command): Refusal | null {
      asked.push(command);
      return (command.type === "plantSapling" || command.type === "plantBerryBush") && command.x < 0 ? { kind: "tooCloseToTree" } : null;
    },
  };
}

describe("the see-through sapling under the mouse", () => {
  it("sits on the ground under the mouse, and says nothing is wrong where the game allows planting", () => {
    const client = clientRefusingWest();

    expect(plantUnderMouse("sapling", { kind: "ground", spot: { x: 3, z: 4 } }, client)).toEqual({ plant: "sapling", spot: { x: 3, z: 4 }, refusal: null });
    expect(client.asked).toEqual([{ type: "plantSapling", x: 3, z: 4 }]);
  });

  it("carries the game's reason where planting is not allowed", () => {
    expect(plantUnderMouse("sapling", { kind: "ground", spot: { x: -1, z: 0 } }, clientRefusingWest())?.refusal).toEqual({ kind: "tooCloseToTree" });
  });

  it("sits on the ground under a finished structure, so the game can say the structure is in the way", () => {
    const pick = { kind: "structure", id: 1, structure: "foundation", under: { kind: "ground", spot: { x: 2, z: 2 } } } as const;

    expect(plantUnderMouse("sapling", pick, clientRefusingWest())?.spot).toEqual({ x: 2, z: 2 });
  });

  it("asks the game about planting a berry bush while planting one", () => {
    const client = clientRefusingWest();

    expect(plantUnderMouse("berryBush", { kind: "ground", spot: { x: -1, z: 0 } }, client)?.refusal).toEqual({ kind: "tooCloseToTree" });
    expect(client.asked).toEqual([{ type: "plantBerryBush", x: -1, z: 0 }]);
  });

  it("is not shown off the ground", () => {
    expect(plantUnderMouse("sapling", undefined, clientRefusingWest())).toBeUndefined();
    expect(plantUnderMouse("sapling", { kind: "river", spot: { x: 0, z: 0 } }, clientRefusingWest())).toBeUndefined();
  });
});

describe("a click while planting", () => {
  it("plants the sapling where it is allowed, and does nothing where it is not", () => {
    expect(plantCommandFor({ plant: "sapling", spot: { x: 3, z: 4 }, refusal: null })).toEqual({ type: "plantSapling", x: 3, z: 4 });
    expect(plantCommandFor({ plant: "berryBush", spot: { x: 3, z: 4 }, refusal: null })).toEqual({ type: "plantBerryBush", x: 3, z: 4 });
    expect(plantCommandFor({ plant: "sapling", spot: { x: 3, z: 4 }, refusal: { kind: "tooCloseToTree" } })).toBeUndefined();
    expect(plantCommandFor(undefined)).toBeUndefined();
  });
});

describe("keys while planting", () => {
  it("stops planting on Escape", () => {
    expect(pressPlantKey("Escape")).toBe(true);
    expect(pressPlantKey("KeyB")).toBe(false);
    expect(pressPlantKey("KeyE")).toBe(false);
  });
});
