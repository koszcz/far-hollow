import { describe, expect, it } from "bun:test";
import { createRandom } from "../sim/random";
import { groundDistance } from "../sim/ground-point";
import { birdMayLandAt, createBirdLife, type BirdLife, type BirdSurroundings, type LandingGround } from "./bird-life";

const NOON: BirdSurroundings = {
  daylight: 1,
  raining: false,
  player: { x: 0, z: 0 },
  canLandAt: () => true,
  groundHeightAt: () => 0,
};

/** Runs the birds for this many seconds, in steps of a tenth of a second. */
function run(life: BirdLife, seconds: number, surroundings: BirdSurroundings = NOON): void {
  for (let t = 0; t < seconds; t += 0.1) life.step(0.1, surroundings);
}

function newLife(seed = 7): BirdLife {
  return createBirdLife(createRandom(seed));
}

describe("bird life", () => {
  it("flies up to 3 flocks of 3 to 5 birds over the treetops", () => {
    const life = newLife();
    run(life, 120);
    const flocks = life.flocks();
    expect(flocks.length).toBe(3);
    for (const flock of flocks) {
      expect(flock.length).toBeGreaterThanOrEqual(3);
      expect(flock.length).toBeLessThanOrEqual(5);
      for (const bird of flock) {
        expect(bird.flying).toBe(true);
        expect(bird.y).toBeGreaterThan(12);
      }
    }
  });

  it("flies flocks above the treetops, over hills as well as flat ground", () => {
    /** Trees grow up to about 14 m tall. */
    const TALLEST_TREE_METRES = 14;
    const hills = (x: number, z: number): number => 10 + 8 * Math.sin(x / 15) * Math.cos(z / 20);
    const life = newLife();
    for (let second = 0; second < 120; second += 1) {
      run(life, 1, { ...NOON, groundHeightAt: hills });
      for (const bird of life.flocks().flat()) expect(bird.y - hills(bird.x, bird.z)).toBeGreaterThan(TALLEST_TREE_METRES);
    }
  });

  it("keeps up to 6 birds pecking on the ground near the player", () => {
    const life = newLife();
    for (let second = 0; second < 120; second += 1) {
      run(life, 1);
      expect(life.groundBirds().length).toBeLessThanOrEqual(6);
    }
    const pecking = life.groundBirds().filter((bird) => !bird.flying);
    expect(pecking.length).toBe(6);
    for (const bird of pecking) expect(groundDistance(bird, NOON.player ?? { x: 0, z: 0 })).toBeLessThan(40);
  });

  it("shows birds only by day", () => {
    const life = newLife();
    run(life, 10, { ...NOON, daylight: 0 });
    expect(life.visibility()).toBe(0);
    run(life, 60, { ...NOON, daylight: 0 });
    expect(life.groundBirds()).toEqual([]);
    expect(life.flocks()).toEqual([]);
    run(life, 120, { ...NOON, daylight: 0.5 });
    expect(life.visibility()).toBe(0.5);
    run(life, 1);
    expect(life.visibility()).toBe(1);
    expect(life.flocks().length).toBe(3);
  });

  it("sends a bird on the ground off when the player comes within 6 m", () => {
    const life = newLife();
    run(life, 1);
    const bird = life.groundBirds()[0];
    if (bird === undefined) throw new Error("no bird landed");
    const closeBy = { x: bird.x + 5.9, z: bird.z };
    run(life, 0.1, { ...NOON, player: closeBy });
    const after = life.groundBirds().find((other) => groundDistance(other, bird) < 0.5);
    expect(after?.flying ?? true).toBe(true);
    // Every bird left on the ground stays at least 6 m from the player.
    run(life, 30, { ...NOON, player: closeBy });
    for (const other of life.groundBirds().filter((one) => !one.flying)) expect(groundDistance(other, closeBy)).toBeGreaterThan(6);
  });

  it("leaves a bird pecking while the player stays farther than 6 m", () => {
    const life = newLife();
    run(life, 1);
    const bird = life.groundBirds()[0];
    if (bird === undefined) throw new Error("no bird landed");
    run(life, 0.1, { ...NOON, player: { x: bird.x + 6.1, z: bird.z } });
    expect(life.groundBirds().some((other) => !other.flying && groundDistance(other, bird) < 0.01)).toBe(true);
  });

  it("keeps birds away while it rains and brings them back gradually after", () => {
    const life = newLife();
    run(life, 10);
    run(life, 60, { ...NOON, raining: true });
    expect(life.visibility()).toBe(0);
    expect(life.groundBirds()).toEqual([]);
    expect(life.flocks()).toEqual([]);
    run(life, 5);
    expect(life.groundBirds().length + life.flocks().length).toBeLessThan(3);
    run(life, 120);
    expect(life.flocks().length).toBe(3);
    expect(life.groundBirds().filter((bird) => !bird.flying).length).toBe(6);
  });

  it("removes every bird, flocks too, as soon as they have faded out in the rain", () => {
    const life = newLife();
    run(life, 10);
    expect(life.flocks().length).toBeGreaterThan(0);
    // Birds fade out in 3 s. A flock's whole path takes about 24 s.
    run(life, 3.5, { ...NOON, raining: true });
    expect(life.visibility()).toBe(0);
    expect(life.flocks()).toEqual([]);
    expect(life.groundBirds()).toEqual([]);
  });

  it("lands no new birds in the faint light just before dark", () => {
    const dusk = { ...NOON, daylight: 0.05 };
    const life = newLife();
    for (let second = 0; second < 60; second += 1) {
      run(life, 1, dusk);
      expect(life.groundBirds().filter((bird) => !bird.flying)).toEqual([]);
    }
  });

  it("starts with no birds when the game loads in the rain", () => {
    const life = newLife();
    run(life, 1, { ...NOON, raining: true });
    expect(life.groundBirds()).toEqual([]);
    expect(life.flocks()).toEqual([]);
  });

  it("starts birds in new places with a new random source", () => {
    const one = newLife(1);
    const other = newLife(2);
    run(one, 1);
    run(other, 1);
    expect(one.groundBirds()[0]).not.toEqual(other.groundBirds()[0]);
  });
});

describe("where a bird may land", () => {
  const clearing: LandingGround = { isClearing: () => true, isRiver: () => false, isUnderCamp: () => false, litFires: [] };

  it("lands in a clearing", () => {
    expect(birdMayLandAt(clearing, { x: 0, z: 0 })).toBe(true);
    expect(birdMayLandAt({ ...clearing, isClearing: () => false }, { x: 0, z: 0 })).toBe(false);
  });

  it("never lands in the river or on a foundation", () => {
    expect(birdMayLandAt({ ...clearing, isRiver: () => true }, { x: 0, z: 0 })).toBe(false);
    expect(birdMayLandAt({ ...clearing, isUnderCamp: () => true }, { x: 0, z: 0 })).toBe(false);
  });

  it("keeps 8 m from a lit fire", () => {
    const nearFire = { ...clearing, litFires: [{ x: 0, z: 0 }] };
    expect(birdMayLandAt(nearFire, { x: 7.9, z: 0 })).toBe(false);
    expect(birdMayLandAt(nearFire, { x: 0, z: 8 })).toBe(false);
    expect(birdMayLandAt(nearFire, { x: 8.1, z: 0 })).toBe(true);
  });

  it("never touches down on a spot that was refused while the bird flew to it", () => {
    const life = newLife();
    // Nowhere to land at first, so every ground bird has to fly in.
    run(life, 0.1, { ...NOON, canLandAt: () => false });
    for (let t = 0; t < 30 && !life.groundBirds().some((bird) => bird.flying); t += 0.1) run(life, 0.1);
    expect(life.groundBirds().some((bird) => bird.flying)).toBe(true);
    // A fire is lit, and no spot may be landed on any more.
    for (let t = 0; t < 30; t += 0.1) {
      run(life, 0.1, { ...NOON, canLandAt: () => false });
      expect(life.groundBirds().filter((bird) => !bird.flying)).toEqual([]);
    }
  });

  it("flies off a spot when a fire is lit within 8 m of it", () => {
    const life = newLife();
    run(life, 1);
    const bird = life.groundBirds()[0];
    if (bird === undefined) throw new Error("no bird landed");
    const fire = { x: bird.x + 7, z: bird.z };
    const ground = { ...clearing, litFires: [fire] };
    run(life, 30, { ...NOON, canLandAt: (spot) => birdMayLandAt(ground, spot) });
    for (const other of life.groundBirds().filter((one) => !one.flying)) expect(groundDistance(other, fire)).toBeGreaterThan(8);
  });
});
