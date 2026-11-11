import { describe, expect, it } from "vitest";
import type { Command } from "./api";
import { createGame, type Game } from "./game";
import { createNeeds, hasCollapsed, needsSpeed, passNeedsTime, wakeFromCollapse } from "./needs";

const DAYTIME_AWAY_FROM_FIRE = { night: false, warmedByCampfire: false, working: false, asleep: false, sick: false };

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

    passNeedsTime(well, 60, { night: true, warmedByCampfire: false, working: false, asleep: false, sick: false });
    passNeedsTime(sick, 60, { night: true, warmedByCampfire: false, working: false, asleep: false, sick: true });

    expect(1 - sick.thirst.level).toBeCloseTo(2 / 24, 5);
    expect(1 - sick.warmth.level).toBeCloseTo(0.5, 5);
    expect(1 - well.warmth.level).toBeCloseTo(0.25, 5);
  });

  it("recover warmth beside a lit campfire at the usual speed while sick", () => {
    const needs = createNeeds();
    needs.warmth.level = 0.2;

    passNeedsTime(needs, 30, { night: true, warmedByCampfire: true, working: false, asleep: false, sick: true });

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
    passNeedsTime(needs, 60, { night: false, warmedByCampfire: false, working: false, asleep: false, sick: false, inRain: true });
    expect(needs.warmth.level).toBeCloseTo(0.75, 5);
  });

  it("drains faster at night than night alone", () => {
    const dry = createNeeds();
    const wet = createNeeds();
    passNeedsTime(dry, 60, { night: true, warmedByCampfire: false, working: false, asleep: false, sick: false, inRain: false });
    passNeedsTime(wet, 60, { night: true, warmedByCampfire: false, working: false, asleep: false, sick: false, inRain: true });
    expect(dry.warmth.level).toBeCloseTo(0.75, 5);
    expect(wet.warmth.level).toBeCloseTo(0.5, 5);
  });

  it("still recovers within a lit campfire's warmth range", () => {
    const needs = createNeeds();
    needs.warmth.level = 0.2;
    passNeedsTime(needs, 30, { night: true, warmedByCampfire: true, working: false, asleep: false, sick: false, inRain: true });
    expect(needs.warmth.level).toBeCloseTo(0.7, 5);
  });
});

function send(game: Game, command: Command): void {
  game.client.send(command);
  game.step();
}
