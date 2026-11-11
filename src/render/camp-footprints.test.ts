import { describe, expect, it } from "vitest";
import { createEntityStore, restoreEntities, saveEntities, type SavedEntity } from "../sim/entities";
import { campFootprints, isUnderCamp, sameFootprints } from "./camp-footprints";

describe("undergrowth under the camp", () => {
  it("hides under a blueprint as soon as it is placed", () => {
    const entities = createEntityStore();
    entities.add({ blueprint: { piece: "campfire", progress: 0, materialsSpent: 0, delivered: {} }, position: { x: 10, y: 0, z: -4 } });
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

  it("hides under a finished woodpile, but not beside it", () => {
    const entities = createEntityStore();
    entities.add({ woodpile: { log: 0, debarkedLog: 0, firewood: 0 }, position: { x: 2, y: 0, z: 3 } });
    const footprints = campFootprints(entities);
    expect(isUnderCamp(footprints, 2.4, 3.4)).toBe(true);
    expect(isUnderCamp(footprints, 3, 3)).toBe(false);
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

  it("hides the same ground under a blueprint as under the finished piece", () => {
    const planned = createEntityStore();
    planned.add({ blueprint: { piece: "campfire", progress: 0, materialsSpent: 0, delivered: {} }, position: { x: 0, y: 0, z: 0 } });
    const built = createEntityStore();
    built.add({ campfire: { lit: false, fuelMinutes: 0 }, position: { x: 0, y: 0, z: 0 } });
    expect(campFootprints(planned)).toEqual(campFootprints(built));
  });

  it("hides under the outer edge of the campfire's stones", () => {
    const entities = createEntityStore();
    entities.add({ campfire: { lit: false, fuelMinutes: 0 }, position: { x: 0, y: 0, z: 0 } });
    // The stones sit about 0.55 m out and reach up to 0.18 m beyond that.
    expect(isUnderCamp(campFootprints(entities), 0.73, 0)).toBe(true);
  });
});

describe("spotting a change in the camp", () => {
  it("sees no change when the same things stand in the same places", () => {
    const entities = createEntityStore();
    entities.add({ campfire: { lit: true, fuelMinutes: 60 }, position: { x: 1, y: 0, z: 2 } });
    entities.add({ bedroll: true, position: { x: 5, y: 0, z: 5 } });
    expect(sameFootprints(campFootprints(entities), campFootprints(entities))).toBe(true);
  });

  it("sees a change when something is placed or removed", () => {
    const entities = createEntityStore();
    const before = campFootprints(entities);
    const bedroll = entities.add({ bedroll: true, position: { x: 5, y: 0, z: 5 } });
    const placed = campFootprints(entities);
    expect(sameFootprints(before, placed)).toBe(false);
    entities.remove(bedroll);
    expect(sameFootprints(placed, campFootprints(entities))).toBe(false);
  });

  it("sees a change when a blueprint is finished into a different shape, or something moves", () => {
    expect(sameFootprints([{ x: 0, z: 0, radius: 0.8 }], [{ x: 0, z: 0, halfX: 0.5, halfZ: 1.1 }])).toBe(false);
    expect(sameFootprints([{ x: 0, z: 0, radius: 0.8 }], [{ x: 0.5, z: 0, radius: 0.8 }])).toBe(false);
    expect(sameFootprints([{ x: 0, z: 0, halfX: 0.5, halfZ: 1.1 }], [{ x: 0, z: 0, halfX: 0.5, halfZ: 1.2 }])).toBe(false);
  });
});
