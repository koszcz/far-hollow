import { describe, expect, it } from "vitest";
import { createEntityStore, restoreEntities, saveEntities, type SavedEntity } from "../sim/entities";
import { campFootprints, isUnderCamp } from "./undergrowth-clearing";

describe("undergrowth under the camp", () => {
  it("hides under a blueprint as soon as it is placed", () => {
    const entities = createEntityStore();
    entities.add({ blueprint: { piece: "campfire", progress: 0, sticksSpent: 0 }, position: { x: 10, y: 0, z: -4 } });
    const footprints = campFootprints(entities);
    expect(isUnderCamp(footprints, 10.3, -4.2)).toBe(true);
    expect(isUnderCamp(footprints, 12, -4)).toBe(false);
  });

  it("hides within the stone ring of a finished campfire", () => {
    const entities = createEntityStore();
    entities.add({ campfire: { lit: true, fuelMinutes: 60 }, position: { x: 0, y: 0, z: 0 } });
    const footprints = campFootprints(entities);
    expect(isUnderCamp(footprints, 0.5, 0.4)).toBe(true);
    expect(isUnderCamp(footprints, 1.5, 0)).toBe(false);
  });

  it("hides under the whole length of a laid bedroll, but not beside it", () => {
    const entities = createEntityStore();
    entities.add({ bedroll: true, position: { x: 5, y: 0, z: 5 } });
    const footprints = campFootprints(entities);
    // The mat lies along z, 1.9 m long and 0.7 m wide.
    expect(isUnderCamp(footprints, 5, 5.9)).toBe(true);
    expect(isUnderCamp(footprints, 5, 4.1)).toBe(true);
    expect(isUnderCamp(footprints, 5.3, 5)).toBe(true);
    expect(isUnderCamp(footprints, 5.8, 5)).toBe(false);
    expect(isUnderCamp(footprints, 5, 6.5)).toBe(false);
  });

  it("shows again once the placed object is removed", () => {
    const entities = createEntityStore();
    const bedroll = entities.add({ bedroll: true, position: { x: 5, y: 0, z: 5 } });
    expect(isUnderCamp(campFootprints(entities), 5, 5)).toBe(true);
    entities.remove(bedroll);
    expect(isUnderCamp(campFootprints(entities), 5, 5)).toBe(false);
  });

  it("stays hidden after saving and loading, from the saved camp alone", () => {
    const entities = createEntityStore();
    entities.add({ campfire: { lit: false, fuelMinutes: 0 }, position: { x: -3, y: 0, z: 2 } });
    const loaded = createEntityStore();
    restoreEntities(loaded, JSON.parse(JSON.stringify(saveEntities(entities))) as SavedEntity[]);
    expect(isUnderCamp(campFootprints(loaded), -3, 2)).toBe(true);
  });

  it("hides nothing when the player has placed nothing", () => {
    expect(isUnderCamp(campFootprints(createEntityStore()), 0, 0)).toBe(false);
  });
});
