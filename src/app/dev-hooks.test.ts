import { describe, expect, it } from "bun:test";
import { createGame, STEPS_PER_SECOND } from "../sim/game";
import type { SoundState } from "../sound/sound-engine";
import { createDevHooks } from "./dev-hooks";

const NO_SOUND: SoundState = { started: false, volume: 0.8, muted: false, hidden: false, overall: 0.8, playing: [], frameMs: 0 };
const readNoSound = () => NO_SOUND;

describe("advancing the game from the dev hooks", () => {
  it("runs one logic step per step of play time asked for, and reports the seconds that ran", () => {
    const game = createGame({ seed: 42 });
    let steps = 0;
    const hooks = createDevHooks(
      game.client,
      () => {
        steps += 1;
        game.step();
        return true;
      },
      readNoSound,
    );

    expect(hooks.advance(2)).toBe(2);
    expect(steps).toBe(2 * STEPS_PER_SECOND);
  });

  it("moves the valley's clock on as far as playing for that long would", () => {
    const played = createGame({ seed: 42 });
    for (let count = 0; count < 90 * STEPS_PER_SECOND; count += 1) played.step();
    const advanced = createGame({ seed: 42 });
    const hooks = createDevHooks(
      advanced.client,
      () => {
        advanced.step();
        return true;
      },
      readNoSound,
    );

    hooks.advance(90);

    expect(advanced.client.getView().time).toMatchObject({ day: 1, hour: 9, minute: 30 });
    expect(advanced.client.getView().time).toEqual(played.client.getView().time);
  });

  it("counts only the steps the game did not hold, such as while the sleep animation plays", () => {
    const game = createGame({ seed: 42 });
    let held = true;
    const hooks = createDevHooks(
      game.client,
      () => {
        held = !held;
        if (held) return false;
        game.step();
        return true;
      },
      readNoSound,
    );

    expect(hooks.advance(1)).toBe(0.5);
  });

  it("turns away a negative or endless amount of time", () => {
    const game = createGame({ seed: 42 });
    const hooks = createDevHooks(game.client, () => true, readNoSound);

    expect(() => hooks.advance(-1)).toThrow(RangeError);
    expect(() => hooks.advance(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => hooks.advance(Number.NaN)).toThrow(RangeError);
  });
});

describe("reading sound from the dev hooks", () => {
  it("shows which sounds play and how loud each one is, as the sound engine reports it now", () => {
    const game = createGame({ seed: 42 });
    let state: SoundState = NO_SOUND;
    const hooks = createDevHooks(
      game.client,
      () => true,
      () => state,
    );
    expect(hooks.sound().playing).toEqual([]);

    state = { ...NO_SOUND, started: true, playing: [{ key: "river", sound: "sound-river", loudness: 0.5, pan: -0.2 }] };

    expect(hooks.sound()).toMatchObject({ started: true, playing: [{ key: "river", loudness: 0.5 }] });
  });
});
