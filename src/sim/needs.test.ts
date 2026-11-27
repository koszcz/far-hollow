import { describe, expect, it } from "bun:test";
import type { Command } from "./api-commands";
import { createGame, type Game } from "./game";
import { createNeeds, hasCollapsed, type NeedConditions, needsSpeed, passNeedsTime, quenchThirst, wakeFromCollapse } from "./needs";

const DAYTIME_AWAY_FROM_FIRE: NeedConditions = { season: "spring", night: false, warmedByCampfire: false, working: false, asleep: false, sick: false };

describe("needs", () => {
  it("start full for all four needs", () => {
    const view = createGame({ seed: 42 }).client.getView();
    expect(view.needs).toEqual({ hunger: 1, thirst: 1, warmth: 1, fatigue: 1 });
  });

  it("change for skipped time: warmth drains at night, thirst, hunger, and fatigue drain all day", () => {
    const game = createGame({ seed: 42 });
    send(game, { type: "skipTime", hours: 14 }); // 22:00, two hours into the night.

    const needs = game.client.getView().needs;
    expect(needs.warmth).toBeCloseTo(0.5, 1);
    expect(needs.warmth).toBe(game.client.getView().warmth);
    expect(needs.thirst).toBeCloseTo(1 - 14 / 24, 2);
    expect(needs.hunger).toBeCloseTo(1 - 14 / 48, 2);
    expect(needs.fatigue).toBeCloseTo(1 - 14 / 24, 2);
  });

  it("drain thirst by day and by night, emptying it over one day", () => {
    const needs = createNeeds();

    passNeedsTime(needs, 6 * 60, DAYTIME_AWAY_FROM_FIRE);
    expect(needs.thirst.level).toBeCloseTo(0.75, 5);

    passNeedsTime(needs, 6 * 60, { ...DAYTIME_AWAY_FROM_FIRE, night: true, warmedByCampfire: true });
    expect(needs.thirst.level).toBeCloseTo(0.5, 5);

    passNeedsTime(needs, 12 * 60, DAYTIME_AWAY_FROM_FIRE);
    expect(needs.thirst.level).toBeCloseTo(0, 5);

    passNeedsTime(needs, 1, DAYTIME_AWAY_FROM_FIRE);
    expect(needs.thirst.level).toBe(0);
  });

  it("drain faster while the player is sick: twice as fast for thirst and warmth", () => {
    const well = createNeeds();
    const sick = createNeeds();

    passNeedsTime(well, 60, { season: "spring", night: true, warmedByCampfire: false, working: false, asleep: false, sick: false });
    passNeedsTime(sick, 60, { season: "spring", night: true, warmedByCampfire: false, working: false, asleep: false, sick: true });

    expect(1 - sick.thirst.level).toBeCloseTo(2 / 24, 5);
    expect(1 - sick.warmth.level).toBeCloseTo(0.5, 5);
    expect(1 - well.warmth.level).toBeCloseTo(0.25, 5);
  });

  it("recover warmth beside a lit campfire at the usual speed while sick", () => {
    const needs = createNeeds();
    needs.warmth.level = 0.2;

    passNeedsTime(needs, 30, { season: "spring", night: true, warmedByCampfire: true, working: false, asleep: false, sick: true });

    expect(needs.warmth.level).toBeCloseTo(0.7, 5);
  });

  it("cause a collapse when a need other than warmth stays at zero for too long", () => {
    const needs = createNeeds();
    needs.thirst.level = 0;

    passNeedsTime(needs, 30, DAYTIME_AWAY_FROM_FIRE);
    expect(hasCollapsed(needs)).toBe(false);

    passNeedsTime(needs, 30, DAYTIME_AWAY_FROM_FIRE);
    expect(hasCollapsed(needs)).toBe(true);
  });

  it("do not cause a collapse when a need is low but not zero", () => {
    const needs = createNeeds();
    needs.hunger.level = 0.01;

    passNeedsTime(needs, 120, DAYTIME_AWAY_FROM_FIRE);

    expect(hasCollapsed(needs)).toBe(false);
  });

  it("wake from a collapse with the empty need low, and leave full needs alone", () => {
    const needs = createNeeds();
    needs.fatigue.level = 0;
    passNeedsTime(needs, 60, DAYTIME_AWAY_FROM_FIRE);

    wakeFromCollapse(needs);

    expect(hasCollapsed(needs)).toBe(false);
    expect(needs.fatigue.level).toBeGreaterThan(0);
    expect(needs.fatigue.level).toBeLessThan(0.3);
    expect(needs.warmth.level).toBe(1);
  });

  it("quench thirst to full and stop the count toward a collapse", () => {
    const needs = createNeeds();
    needs.thirst.level = 0;
    needs.thirst.minutesWithout = 40;

    quenchThirst(needs);

    expect(needs.thirst).toEqual({ level: 1, minutesWithout: 0 });
  });

  it("slow the player when a need other than warmth is low", () => {
    const full = createNeeds();
    const hungry = createNeeds();
    hungry.hunger.level = 0;

    expect(needsSpeed(full)).toBe(1);
    expect(needsSpeed(hungry)).toBeCloseTo(0.4, 5);
  });

  it("slow the player as much as the lowest need decides", () => {
    const needs = createNeeds();
    needs.thirst.level = 0.15;
    needs.fatigue.level = 0;
    needs.warmth.level = 0.2;

    expect(needsSpeed(needs)).toBeCloseTo(0.4, 5);
  });
});

describe("warmth in the rain", () => {
  it("drains during the day", () => {
    const needs = createNeeds();
    passNeedsTime(needs, 60, { season: "spring", night: false, warmedByCampfire: false, working: false, asleep: false, sick: false, inRain: true });
    expect(needs.warmth.level).toBeCloseTo(0.75, 5);
  });

  it("drains faster at night than night alone", () => {
    const dry = createNeeds();
    const wet = createNeeds();
    passNeedsTime(dry, 60, { season: "spring", night: true, warmedByCampfire: false, working: false, asleep: false, sick: false, inRain: false });
    passNeedsTime(wet, 60, { season: "spring", night: true, warmedByCampfire: false, working: false, asleep: false, sick: false, inRain: true });
    expect(dry.warmth.level).toBeCloseTo(0.75, 5);
    expect(wet.warmth.level).toBeCloseTo(0.5, 5);
  });

  it("still recovers within a lit campfire's warmth range", () => {
    const needs = createNeeds();
    needs.warmth.level = 0.2;
    passNeedsTime(needs, 30, { season: "spring", night: true, warmedByCampfire: true, working: false, asleep: false, sick: false, inRain: true });
    expect(needs.warmth.level).toBeCloseTo(0.7, 5);
  });
});

describe("warmth in a snug room", () => {
  const NIGHT_AWAY_FROM_FIRE: NeedConditions = { season: "spring", night: true, warmedByCampfire: false, working: false, asleep: false, sick: false };

  it("drains at half the usual rate at night", () => {
    const needs = createNeeds();
    passNeedsTime(needs, 60, { ...NIGHT_AWAY_FROM_FIRE, inSnugRoom: true });
    expect(needs.warmth.level).toBeCloseTo(0.875, 5);
  });

  it("still recovers by a lit fire", () => {
    const needs = createNeeds();
    needs.warmth.level = 0.2;
    passNeedsTime(needs, 30, { ...NIGHT_AWAY_FROM_FIRE, warmedByCampfire: true, inSnugRoom: true });
    expect(needs.warmth.level).toBeCloseTo(0.7, 5);
  });
});

describe("warmth by season", () => {
  const AWAY_FROM_FIRE = { season: "spring", warmedByCampfire: false, working: false, asleep: false, sick: false } as const;

  /** How much warmth one game hour drains away from a fire in these conditions. */
  function drainInOneHour(conditions: Partial<NeedConditions>): number {
    const needs = createNeeds();
    passNeedsTime(needs, 60, { ...AWAY_FROM_FIRE, night: false, ...conditions });
    return 1 - needs.warmth.level;
  }

  it.each([
    ["spring", 0, 0.25],
    ["summer", 0, 0.25],
    ["autumn", 0, 0.375],
    ["winter", 0.1, 0.5],
  ] as const)("drains in %s by day and by night, in warmth per hour", (season, day, night) => {
    expect(drainInOneHour({ season, night: false })).toBeCloseTo(day, 5);
    expect(drainInOneHour({ season, night: true })).toBeCloseTo(night, 5);
  });

  it.each([
    ["spring", 0, 0.125],
    ["summer", 0, 0.125],
    ["autumn", 0, 0.1875],
    ["winter", 0.05, 0.25],
  ] as const)("drains in %s at half the rate in a snug room, by day and by night", (season, day, night) => {
    expect(drainInOneHour({ season, night: false, inSnugRoom: true })).toBeCloseTo(day, 5);
    expect(drainInOneHour({ season, night: true, inSnugRoom: true })).toBeCloseTo(night, 5);
  });

  it("adds the rain's chill outdoors and doubles every drain while sick", () => {
    expect(drainInOneHour({ season: "winter", night: false, inRain: true })).toBeCloseTo(0.35, 5);
    expect(drainInOneHour({ season: "winter", night: false, sick: true })).toBeCloseTo(0.2, 5);
    expect(drainInOneHour({ season: "winter", night: true, inRain: true, sick: true })).toBeCloseTo(1, 5);
  });

  it("still recovers by a lit fire in winter", () => {
    const needs = createNeeds();
    needs.warmth.level = 0.2;
    passNeedsTime(needs, 30, { ...AWAY_FROM_FIRE, night: true, season: "winter", warmedByCampfire: true });
    expect(needs.warmth.level).toBeCloseTo(0.7, 5);
  });
});

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
}
