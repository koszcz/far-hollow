import { describe, expect, it } from "bun:test";
import { createEntityStore } from "../sim/entities";
import { GROUND_CHANGE_MINUTES } from "../sim/ground-change";
import { groundTypeWeightsAt } from "../sim/ground-types";
import type { River } from "../sim/valley";
import { createGroundNow, REFRESH_GAME_MINUTES } from "./ground-now";

const river: River = {
  path: [
    { x: 0, z: -500 },
    { x: 0, z: 500 },
  ],
  width: 8,
};
const tree = { x: 100, z: 0 };
const valley = { size: 1000, river, trees: [tree] };

function setUp() {
  const entities = createEntityStore();
  const clock = { minutes: 600 };
  const ground = createGroundNow(valley, entities, () => clock.minutes);
  return { entities, clock, ground };
}

describe("the drawing's ground", () => {
  it("changes nothing while no change has started", () => {
    const { clock, ground } = setUp();
    clock.minutes += 60;
    expect(ground.refresh()).toEqual([]);
  });

  it("redraws round a change as soon as it starts", () => {
    const { entities, clock, ground } = setUp();
    entities.add({ groundChange: { ...tree, toward: "clearing", startedAtMinutes: clock.minutes } });
    const [area, ...others] = ground.refresh();
    expect(others).toEqual([]);
    expect(area?.minX).toBeLessThan(tree.x - 7);
    expect(area?.maxX).toBeGreaterThan(tree.x + 7);
  });

  it("moves a change under way on every few game minutes, until it is over", () => {
    const { entities, clock, ground } = setUp();
    entities.add({ groundChange: { ...tree, toward: "clearing", startedAtMinutes: clock.minutes } });
    ground.refresh();
    clock.minutes += REFRESH_GAME_MINUTES / 2;
    expect(ground.refresh()).toEqual([]);
    clock.minutes += REFRESH_GAME_MINUTES;
    expect(ground.refresh()).toHaveLength(1);

    clock.minutes += GROUND_CHANGE_MINUTES;
    expect(ground.refresh()).toHaveLength(1);
    expect(groundTypeWeightsAt(ground.map(), { x: 101, z: 0 }).forestFloor).toBe(0);
    clock.minutes += 60;
    expect(ground.refresh()).toEqual([]);
  });

  it("starts with every change already made, as a loaded game has", () => {
    const entities = createEntityStore();
    entities.add({ groundChange: { ...tree, toward: "clearing", startedAtMinutes: 0 } });
    const ground = createGroundNow(valley, entities, () => GROUND_CHANGE_MINUTES);
    expect(groundTypeWeightsAt(ground.map(), { x: 101, z: 0 }).forestFloor).toBe(0);
    expect(ground.refresh()).toEqual([]);
  });
});
