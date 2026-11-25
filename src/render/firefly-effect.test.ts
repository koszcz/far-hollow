import { describe, expect, it } from "bun:test";
import * as THREE from "three";
import { createEntityStore, type EntityStore } from "../sim/entities";
import { createRandom } from "../sim/random";
import { createFireflyEffect } from "./firefly-effect";

const NIGHT = 0;

/** Where every drawn firefly is over a minute of night, one frame every half second, as one flat list of numbers. */
function fireflySpots(entities: EntityStore): number[] {
  const effect = createFireflyEffect(entities, { isOpen: () => true, heightAt: () => 0 }, createRandom(11));
  const points = effect.group.children[0] as THREE.Points | undefined;
  if (points === undefined) throw new Error("no firefly points");
  const spots: number[] = [];
  for (let frame = 0; frame < 120; frame += 1) {
    effect.update(frame / 2, { x: 0, z: 0 }, NIGHT, true);
    const positions = points.geometry.getAttribute("position");
    const shown = points.geometry.drawRange.count;
    for (let index = 0; index < shown; index += 1) spots.push(positions.getX(index), positions.getY(index), positions.getZ(index));
  }
  effect.dispose();
  return spots;
}

describe("the firefly effect", () => {
  it("glows in the same places with or without a camp and a lit fire", () => {
    const camp = createEntityStore();
    camp.add({ campfire: { lit: true, fuelMinutes: 60 }, position: { x: 1, y: 0, z: 1 } });
    camp.add({ woodpile: { log: 0, debarkedLog: 0, firewood: 0 }, position: { x: -2, y: 0, z: 3 } });
    camp.add({ bedroll: true, position: { x: 3, y: 0, z: -2 } });
    const withCamp = fireflySpots(camp);
    expect(withCamp.length).toBeGreaterThan(0);
    expect(withCamp).toEqual(fireflySpots(createEntityStore()));
  });
});
