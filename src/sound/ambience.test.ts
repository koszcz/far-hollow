import { describe, expect, it } from "bun:test";
import type { River } from "../sim/valley";
import { ambienceWishes, type AmbienceScene, type FireSound } from "./ambience";
import { listenerFrom } from "./listener";
import { rainHearingNow } from "./rain-hearing";
import type { SoundWish } from "./sound-mix";

/** A straight river 4 m wide, running along z with its middle on x = 0. Its edges are at x = -2 and x = 2. */
const RIVER: River = {
  path: [
    { x: 0, z: -200 },
    { x: 0, z: 200 },
  ],
  width: 4,
};
const CAMERA_LOOKS_ALONG_Z = { eye: { x: 0, z: -10 }, focus: { x: 0, z: 0 } };

function listenerAt(x: number, z: number) {
  return listenerFrom({ x, z }, { eye: { x, z: z - 10 }, focus: { x, z } });
}

function scene(changes: Partial<AmbienceScene> = {}): AmbienceScene {
  return { river: RIVER, wind: 0.3, fires: [], rain: rainHearingNow(false, false), daylight: 1, ...changes };
}

function wishOf(wishes: readonly SoundWish[], key: string): SoundWish | undefined {
  return wishes.find((wish) => wish.key === key);
}

function loudnessOf(wishes: readonly SoundWish[], key: string): number {
  return wishOf(wishes, key)?.loudness ?? 0;
}

describe("the river", () => {
  it("is loudest at the water's edge, quieter farther away, and silent 30 m from the water", () => {
    const atEdge = loudnessOf(ambienceWishes(listenerAt(2, 0), scene()), "river");
    const away = loudnessOf(ambienceWishes(listenerAt(12, 0), scene()), "river");
    expect(atEdge).toBeGreaterThan(away);
    expect(away).toBeGreaterThan(0);
    expect(loudnessOf(ambienceWishes(listenerAt(2 + 30, 0), scene()), "river")).toBe(0);
  });

  it("is as loud in the water as at its edge", () => {
    expect(loudnessOf(ambienceWishes(listenerAt(0.5, 0), scene()), "river")).toBe(loudnessOf(ambienceWishes(listenerAt(2, 0), scene()), "river"));
  });

  it("plays from the nearest bit of water, so it pans toward it", () => {
    // Looking along +z, the river on the -x side is on the screen's right.
    const fromEast = wishOf(ambienceWishes(listenerFrom({ x: 10, z: 0 }, { eye: { x: 10, z: -10 }, focus: { x: 10, z: 0 } }), scene()), "river");
    expect(fromEast?.pan).toBeCloseTo(1);
    const fromWest = wishOf(ambienceWishes(listenerFrom({ x: -10, z: 0 }, { eye: { x: -10, z: -10 }, focus: { x: -10, z: 0 } }), scene()), "river");
    expect(fromWest?.pan).toBeCloseTo(-1);
  });
});

describe("the forest", () => {
  it("rustles louder as the wind blows harder", () => {
    const calm = loudnessOf(ambienceWishes(listenerAt(50, 0), scene({ wind: 0 })), "forest");
    const breeze = loudnessOf(ambienceWishes(listenerAt(50, 0), scene({ wind: 0.3 })), "forest");
    const gale = loudnessOf(ambienceWishes(listenerAt(50, 0), scene({ wind: 1 })), "forest");
    expect(calm).toBeGreaterThan(0);
    expect(breeze).toBeGreaterThan(calm);
    expect(gale).toBeGreaterThan(breeze);
    expect(gale).toBeLessThanOrEqual(1);
  });

  it("plays all around the player, from neither side", () => {
    expect(wishOf(ambienceWishes(listenerAt(50, 0), scene()), "forest")?.pan).toBe(0);
  });
});

describe("fires", () => {
  const fireAt = (flameSize: number, id = 7): FireSound => ({ id, spot: { x: 50, z: 5 }, flameSize });

  it("crackle louder the bigger the flame", () => {
    const small = loudnessOf(ambienceWishes(listenerAt(50, 0), scene({ fires: [fireAt(0.35)] })), "fire-7");
    const big = loudnessOf(ambienceWishes(listenerAt(50, 0), scene({ fires: [fireAt(1)] })), "fire-7");
    expect(small).toBeGreaterThan(0);
    expect(big).toBeGreaterThan(small);
  });

  it("are silent while out", () => {
    expect(loudnessOf(ambienceWishes(listenerAt(50, 0), scene({ fires: [fireAt(0)] })), "fire-7")).toBe(0);
  });

  it("fade with distance from the player and pan by where they are", () => {
    const near = wishOf(ambienceWishes(listenerAt(50, 0), scene({ fires: [fireAt(1)] })), "fire-7");
    const far = wishOf(ambienceWishes(listenerAt(50, -20), scene({ fires: [fireAt(1)] })), "fire-7");
    expect(near?.loudness ?? 0).toBeGreaterThan(far?.loudness ?? 0);
    const toTheLeft = wishOf(ambienceWishes(listenerFrom({ x: 40, z: 5 }, CAMERA_LOOKS_ALONG_Z), scene({ fires: [fireAt(1)] })), "fire-7");
    expect(toTheLeft?.pan).toBeCloseTo(-1);
  });

  it("each play as their own sound", () => {
    const wishes = ambienceWishes(listenerAt(50, 0), scene({ fires: [fireAt(1, 1), fireAt(1, 2)] }));
    expect(wishes.filter((wish) => wish.sound === "sound-fire").map((wish) => wish.key)).toEqual(["fire-1", "fire-2"]);
  });
});

describe("rain", () => {
  it("is silent while dry", () => {
    const wishes = ambienceWishes(listenerAt(50, 0), scene());
    expect(loudnessOf(wishes, "rain")).toBe(0);
    expect(loudnessOf(wishes, "rain-roof")).toBe(0);
  });

  it("plays all around the player while rain falls in the open", () => {
    const rain = wishOf(ambienceWishes(listenerAt(50, 0), scene({ rain: rainHearingNow(true, false) })), "rain");
    expect(rain?.sound).toBe("sound-rain");
    expect(rain?.loudness ?? 0).toBeGreaterThan(0);
    expect(rain?.pan).toBe(0);
    expect(loudnessOf(ambienceWishes(listenerAt(50, 0), scene({ rain: rainHearingNow(true, false) })), "rain-roof")).toBe(0);
  });

  it("switches to the drumming on the roof under a roof", () => {
    const wishes = ambienceWishes(listenerAt(50, 0), scene({ rain: rainHearingNow(true, true) }));
    expect(loudnessOf(wishes, "rain")).toBe(0);
    expect(wishOf(wishes, "rain-roof")?.sound).toBe("sound-rain-roof");
    expect(loudnessOf(wishes, "rain-roof")).toBeGreaterThan(0);
  });
});

describe("birds and crickets", () => {
  it("are birds by day and crickets at night, all around the player", () => {
    const day = ambienceWishes(listenerAt(50, 0), scene({ daylight: 1 }));
    expect(wishOf(day, "birds")?.sound).toBe("sound-birds");
    expect(loudnessOf(day, "birds")).toBeGreaterThan(0);
    expect(loudnessOf(day, "crickets")).toBe(0);
    const night = ambienceWishes(listenerAt(50, 0), scene({ daylight: 0 }));
    expect(wishOf(night, "crickets")?.sound).toBe("sound-crickets");
    expect(wishOf(night, "crickets")?.pan).toBe(0);
    expect(loudnessOf(night, "crickets")).toBeGreaterThan(0);
    expect(loudnessOf(night, "birds")).toBe(0);
  });
});

describe("a room", () => {
  it("changes only the rain", () => {
    const withoutRain = (wishes: readonly SoundWish[]) => wishes.filter((wish) => !wish.key.startsWith("rain"));
    for (const daylight of [0, 0.5, 1]) {
      const outside = ambienceWishes(listenerAt(10, 0), scene({ daylight, wind: 0.8, rain: rainHearingNow(true, false) }));
      const inside = ambienceWishes(listenerAt(10, 0), scene({ daylight, wind: 0.8, rain: rainHearingNow(true, true) }));
      expect(withoutRain(inside)).toEqual(withoutRain(outside));
      expect(loudnessOf(inside, "rain")).not.toBe(loudnessOf(outside, "rain"));
    }
  });
});
