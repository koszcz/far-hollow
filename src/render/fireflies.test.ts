import { describe, expect, it } from "bun:test";
import { createGroundMap, groundTypeAt } from "../sim/ground-types";
import { createRandom } from "../sim/random";
import { distanceToRiver, generateValley } from "../sim/valley";
import { daylightAt } from "./daylight";
import { nightHoursOf } from "../sim/season";

const SPRING = nightHoursOf("spring");
import { createFireflySwarm, FIREFLY_COUNT, FIREFLY_DRIFT_METRES, FIREFLY_RADIUS_METRES, fireflyOpenGround, type FireflyGround } from "./fireflies";

const OPEN_EVERYWHERE: FireflyGround = { isOpen: () => true, heightAt: () => 0 };
const PLAYER = { x: 0, z: 0 };
const NIGHT = 0;

/** Watches the swarm for a minute, one frame every 1/30 s, and returns the most fireflies glowing at once. */
function mostGlowing(swarm: ReturnType<typeof createFireflySwarm>, daylight: number, raining = false): number {
  let most = 0;
  for (let frame = 0; frame < 30 * 60; frame += 1) {
    const glowing = swarm.update(frame / 30, PLAYER, daylight, raining).filter((firefly) => firefly.glow > 0).length;
    most = Math.max(most, glowing);
  }
  return most;
}

describe("fireflies", () => {
  it("are 40 at most, and many of them glow at night", () => {
    const swarm = createFireflySwarm(OPEN_EVERYWHERE, createRandom(1));
    expect(FIREFLY_COUNT).toBe(40);
    expect(swarm.update(0, PLAYER, NIGHT, false).length).toBeLessThanOrEqual(40);
    expect(mostGlowing(swarm, NIGHT)).toBeGreaterThan(10);
  });

  it("follow daylight: none by day, fading in through the dusk", () => {
    const swarm = createFireflySwarm(OPEN_EVERYWHERE, createRandom(2));
    expect(mostGlowing(swarm, daylightAt(12, SPRING))).toBe(0);
    const brightest = (hour: number): number => {
      let most = 0;
      for (let frame = 0; frame < 30 * 10; frame += 1)
        for (const firefly of swarm.update(frame / 30, PLAYER, daylightAt(hour, SPRING), false)) most = Math.max(most, firefly.glow);
      return most;
    };
    const dusk = brightest(19);
    expect(dusk).toBeGreaterThan(0);
    expect(dusk).toBeLessThan(brightest(23));
    expect(brightest(23)).toBeGreaterThan(0.9);
  });

  it("stay away while it rains, and come back after it stops", () => {
    const swarm = createFireflySwarm(OPEN_EVERYWHERE, createRandom(3));
    expect(mostGlowing(swarm, NIGHT, true)).toBe(0);
    // Rain starts during a dry night: the fireflies are gone a few seconds later.
    const dry = createFireflySwarm(OPEN_EVERYWHERE, createRandom(4));
    dry.update(0, PLAYER, NIGHT, false);
    dry.update(5, PLAYER, NIGHT, true);
    expect(dry.update(10, PLAYER, NIGHT, true).filter((firefly) => firefly.glow > 0)).toEqual([]);
    expect(mostGlowing(dry, NIGHT, false)).toBeGreaterThan(10);
  });

  it("fly only over open ground", () => {
    // Open ground is everything east of x = 0.
    const eastOnly: FireflyGround = { isOpen: (spot) => spot.x > 0, heightAt: () => 0 };
    const swarm = createFireflySwarm(eastOnly, createRandom(5));
    for (let frame = 0; frame < 30 * 60; frame += 1) for (const firefly of swarm.update(frame / 30, PLAYER, NIGHT, false)) expect(firefly.x).toBeGreaterThan(0);
  });

  it("stay near the player, and follow when the player walks away", () => {
    const swarm = createFireflySwarm(OPEN_EVERYWHERE, createRandom(6));
    const reach = FIREFLY_RADIUS_METRES + FIREFLY_DRIFT_METRES * Math.SQRT2;
    const away = { x: 200, z: 0 };
    for (let frame = 0; frame < 30 * 60; frame += 1) {
      const player = frame < 30 * 10 ? PLAYER : away;
      const fireflies = swarm.update(frame / 30, player, NIGHT, false);
      // A firefly left behind finishes its blink before it moves, so allow one blink cycle after the player moves.
      if (frame >= 30 * 10 && frame < 30 * 15) continue;
      for (const firefly of fireflies) if (firefly.glow > 0) expect(Math.hypot(firefly.x - player.x, firefly.z - player.z)).toBeLessThan(reach);
    }
    expect(swarm.update(60, away, NIGHT, false).length).toBe(FIREFLY_COUNT);
  });

  it("start in new places each time the game loads", () => {
    const first = createFireflySwarm(OPEN_EVERYWHERE).update(0, PLAYER, NIGHT, false);
    const second = createFireflySwarm(OPEN_EVERYWHERE).update(0, PLAYER, NIGHT, false);
    expect(first.map((firefly) => firefly.x)).not.toEqual(second.map((firefly) => firefly.x));
  });
});

describe("fireflyOpenGround", () => {
  const valley = generateValley(42);
  const map = createGroundMap(valley);
  const isOpen = fireflyOpenGround(map);
  const spots: { x: number; z: number }[] = [];
  for (let x = -valley.size / 2; x < valley.size / 2; x += 4) for (let z = -valley.size / 2; z < valley.size / 2; z += 4) spots.push({ x, z });

  it("is open over clearings and the river bank, out of the water", () => {
    const open = spots.filter((spot) => isOpen(spot));
    expect(open.some((spot) => groundTypeAt(map, spot) === "clearing")).toBe(true);
    expect(open.some((spot) => groundTypeAt(map, spot) === "riverBank")).toBe(true);
    for (const spot of open) {
      expect(groundTypeAt(map, spot)).not.toBe("forestFloor");
      expect(distanceToRiver(map.river, spot)).toBeGreaterThanOrEqual(map.river.width / 2);
    }
  });

  it("is closed over the forest floor", () => {
    const forest = spots.filter((spot) => groundTypeAt(map, spot) === "forestFloor");
    expect(forest.length).toBeGreaterThan(0);
    for (const spot of forest) expect(isOpen(spot)).toBe(false);
  });
});
