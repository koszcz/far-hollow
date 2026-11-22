import { describe, expect, it } from "bun:test";
import { MAX_SOUNDS, soundsToPlay, type SoundWish } from "./sound-mix";

function fire(index: number, loudness: number): SoundWish {
  return { key: `fire-${index}`, sound: "sound-fire", loudness, pan: 0 };
}

describe("the sound limit", () => {
  it("is 16 sounds at once", () => {
    expect(MAX_SOUNDS).toBe(16);
  });

  it("plays every sound while 16 or fewer want to play", () => {
    const wishes = Array.from({ length: 16 }, (_, index) => fire(index, 0.5));
    expect(soundsToPlay(wishes)).toHaveLength(16);
  });

  it("stops the quietest sounds when more than 16 want to play", () => {
    // Fire 0 is the quietest and fire 19 the loudest.
    const wishes = Array.from({ length: 20 }, (_, index) => fire(index, (index + 1) / 20));
    const playing = soundsToPlay(wishes).map((wish) => wish.key);
    expect(playing).toHaveLength(16);
    expect(playing).not.toContain("fire-0");
    expect(playing).not.toContain("fire-3");
    expect(playing).toContain("fire-4");
    expect(playing).toContain("fire-19");
  });

  it("never plays a silent sound", () => {
    expect(soundsToPlay([fire(0, 0), fire(1, 0.2)]).map((wish) => wish.key)).toEqual(["fire-1"]);
  });
});
