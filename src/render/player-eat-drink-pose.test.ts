import { describe, expect, it } from "bun:test";
import { HAND_AT_SECONDS, REACH_SECONDS } from "../sim/hand-reach";
import { EAT_DRINK_KINDS, eatDrinkCutShort, eatDrinkPoseAt, eatDrinkSecondsOf, reachMotionOf, upperBodyOf, type EatDrinkKind } from "./player-eat-drink-pose";

/** How high a wrist must be to count as at the mouth, in metres above the feet. The hands hang about 1 m up at the chest. */
const AT_MOUTH = 1.15;
/** How far the hips sink to count as kneeling, in metres. The build crouch sinks them 0.11 m. */
const KNEELING = 0.25;

const rightHandOf = (kind: EatDrinkKind, seconds: number) => {
  const { body } = eatDrinkPoseAt(kind, seconds);
  return body.rightHand ?? body.hands;
};

/** Each moment of a motion, every 10 ms. */
const momentsOf = (kind: EatDrinkKind): number[] => Array.from({ length: Math.round(eatDrinkSecondsOf(kind) * 100) + 1 }, (_, i) => i / 100);

describe("the forage, eat, and drink motions", () => {
  it("each take about one second", () => {
    for (const kind of EAT_DRINK_KINDS) {
      expect(eatDrinkSecondsOf(kind)).toBeGreaterThanOrEqual(0.8);
      expect(eatDrinkSecondsOf(kind)).toBeLessThanOrEqual(1.2);
    }
  });

  it("take as long as the hand reach when game logic times them by it", () => {
    expect(eatDrinkSecondsOf("forageBush")).toBe(REACH_SECONDS);
    expect(eatDrinkSecondsOf("fillPot")).toBe(REACH_SECONDS);
  });

  it("start and end standing, so they play once without a jump", () => {
    for (const kind of EAT_DRINK_KINDS) {
      for (const seconds of [0, eatDrinkSecondsOf(kind)]) {
        const { body } = eatDrinkPoseAt(kind, seconds);
        expect(body.reach).toBeCloseTo(0, 5);
        expect(body.hipsDrop).toBeCloseTo(0, 5);
        expect(body.chestLean).toBeCloseTo(0, 5);
        expect(body.headTilt).toBeCloseTo(0, 5);
      }
    }
  });

  it("move smoothly, with no jump between moments", () => {
    for (const kind of EAT_DRINK_KINDS) {
      const moments = momentsOf(kind);
      for (let i = 1; i < moments.length; i += 1) {
        const a = eatDrinkPoseAt(kind, moments[i - 1] ?? 0).body;
        const b = eatDrinkPoseAt(kind, moments[i] ?? 0).body;
        expect(Math.abs(a.reach - b.reach)).toBeLessThan(0.15);
        expect(Math.abs(a.hipsDrop - b.hipsDrop)).toBeLessThan(0.05);
        expect(Math.abs((a.rightHand ?? a.hands).height - (b.rightHand ?? b.hands).height)).toBeLessThan(0.1);
        expect(Number.isFinite(b.hands.forward + b.hands.height + b.hands.spread + b.hipsLean + b.headTilt)).toBe(true);
      }
    }
  });

  it("reaches into a berry bush at chest height when the hand gets there", () => {
    const { body } = eatDrinkPoseAt("forageBush", HAND_AT_SECONDS);
    const hand = body.rightHand ?? body.hands;
    expect(body.reach).toBeCloseTo(1, 2);
    expect(hand.height).toBeGreaterThan(0.8);
    expect(hand.height).toBeLessThan(1.2);
    expect(hand.forward).toBeGreaterThan(0.4);
    expect(body.hipsDrop).toBeLessThan(0.05);
    expect(eatDrinkPoseAt("forageBush", HAND_AT_SECONDS).arms).toBe("right");
  });

  it("raises one hand to the mouth twice to eat", () => {
    let raises = 0;
    let atMouth = false;
    for (const seconds of momentsOf("eat")) {
      const { body } = eatDrinkPoseAt("eat", seconds);
      const nowAtMouth = body.reach > 0.9 && rightHandOf("eat", seconds).height > AT_MOUTH;
      if (nowAtMouth && !atMouth) raises += 1;
      atMouth = nowAtMouth;
    }
    expect(raises).toBe(2);
    expect(eatDrinkPoseAt("eat", 0.5).arms).toBe("right");
    expect(eatDrinkPoseAt("eat", 0.5).pot).toBeUndefined();
  });

  it("kneels at the river bank and raises cupped hands to the mouth to drink from the river", () => {
    const moments = momentsOf("drinkFromRiver").map((seconds) => eatDrinkPoseAt("drinkFromRiver", seconds));
    const lowest = Math.min(...moments.map(({ body }) => body.hands.height));
    expect(lowest).toBeLessThan(0.3);
    expect(Math.max(...moments.map(({ body }) => body.hipsDrop))).toBeGreaterThan(KNEELING);
    // Kneeling, the mouth is lower than standing. The cupped hands come up close together in front of it.
    const drinking = moments.filter(({ body }) => body.reach > 0.9 && body.hands.height > AT_MOUTH - body.hipsDrop - 0.05);
    expect(drinking.length).toBeGreaterThan(0);
    for (const { body } of drinking) expect(body.hands.spread).toBeLessThan(0.08);
    expect(moments.every(({ arms, pot }) => arms === "both" && pot === undefined)).toBe(true);
  });

  it("kneels at the river bank and dips the pot into the water, holding it the whole time", () => {
    const { body, pot } = eatDrinkPoseAt("fillPot", HAND_AT_SECONDS);
    expect(body.hipsDrop).toBeGreaterThan(KNEELING);
    expect(body.hands.height).toBeLessThan(0.3);
    expect(pot?.tilt).toBeGreaterThan(0);
    for (const seconds of momentsOf("fillPot")) expect(eatDrinkPoseAt("fillPot", seconds).pot).toBeDefined();
    expect(eatDrinkPoseAt("fillPot", HAND_AT_SECONDS - 0.05).pot?.look).toBe("empty");
    expect(eatDrinkPoseAt("fillPot", HAND_AT_SECONDS + 0.05).pot?.look).toBe("full");
  });

  it("raises the pot to the mouth to drink from it, holding it the whole time", () => {
    const moments = momentsOf("drinkFromPot").map((seconds) => eatDrinkPoseAt("drinkFromPot", seconds));
    expect(moments.every(({ pot }) => pot !== undefined)).toBe(true);
    const drinking = moments.filter(({ body }) => body.reach > 0.9 && body.hands.height > AT_MOUTH - 0.2);
    expect(drinking.length).toBeGreaterThan(0);
    // The rim tips toward the mouth as the player drinks.
    expect(Math.min(...moments.map(({ pot }) => pot?.tilt ?? 0))).toBeLessThan(-0.5);
    expect(moments[0]?.pot?.look).toBe("full");
    expect(moments.at(-1)?.pot?.look).toBe("empty");
  });
});

describe("a bite or drink while the player does something else", () => {
  const standing = { walking: false, busyWith: undefined };
  const walking = { walking: true, busyWith: undefined };
  const building = { walking: false, busyWith: "build" };

  it("plays over walking or work that was already under way when it began", () => {
    expect(eatDrinkCutShort(walking, walking)).toBe(false);
    expect(eatDrinkCutShort(building, building)).toBe(false);
  });

  it("goes on when the walking or work under way stops", () => {
    expect(eatDrinkCutShort(walking, standing)).toBe(false);
    expect(eatDrinkCutShort(building, standing)).toBe(false);
  });

  it("is cut short by walking or work that starts after it began", () => {
    expect(eatDrinkCutShort(standing, walking)).toBe(true);
    expect(eatDrinkCutShort(standing, building)).toBe(true);
    expect(eatDrinkCutShort(building, { walking: false, busyWith: "chop" })).toBe(true);
    expect(eatDrinkCutShort(building, { walking: true, busyWith: "build" })).toBe(true);
  });
});

describe("a bite or drink over walking or work", () => {
  it("moves only the arms and head, leaving the hips and chest to the motion underneath", () => {
    const { body } = eatDrinkPoseAt("eat", 0.22);
    const upper = upperBodyOf(body);

    expect(upper).toMatchObject({ hipsDrop: 0, hipsBack: 0, hipsLean: 0, chestLean: 0 });
    expect(upper.headTilt).toBe(body.headTilt);
    expect(upper.reach).toBe(body.reach);
    expect(upper.hands).toEqual(body.hands);
    expect(upper.rightHand).toEqual(body.rightHand);
  });
});

describe("which reach plays its own motion", () => {
  it("reaches into the bush for berries and dips the pot for river water", () => {
    expect(reachMotionOf("berries")).toBe("forageBush");
    expect(reachMotionOf("riverWater")).toBe("fillPot");
  });

  it("leaves mushrooms, and reaches that take nothing in particular, to the plain reach", () => {
    expect(reachMotionOf("mushroom")).toBeUndefined();
    expect(reachMotionOf(undefined)).toBeUndefined();
  });
});
