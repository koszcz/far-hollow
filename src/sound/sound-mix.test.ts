import { describe, expect, it } from "bun:test";
import { MAX_SOUNDS, soundKeys, soundsToPlay, type SoundWish } from "./sound-mix";

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

  it("stops exactly the quietest sounds when more than 16 want to play, wherever they are in the list", () => {
    // Fires 0 to 3 are the four quietest. They are spread through the list, between louder ones.
    const loudness = [0.9, 0.05, 0.6, 0.7, 0.02, 0.8, 0.5, 0.55, 0.65, 0.04, 0.75, 0.85, 0.45, 0.95, 0.03, 0.35, 0.4, 0.3, 0.25, 0.2];
    const quietest = ["fire-4", "fire-14", "fire-9", "fire-1"];
    const wishes = loudness.map((each, index) => fire(index, each));
    const playing = soundsToPlay(wishes).map((wish) => wish.key);
    expect(playing).toHaveLength(16);
    for (const key of quietest) expect(playing).not.toContain(key);
    const kept = wishes.map((wish) => wish.key).filter((key) => !quietest.includes(key));
    expect([...playing].sort()).toEqual([...kept].sort());
  });

  it("never plays a silent sound", () => {
    expect(soundsToPlay([fire(0, 0), fire(1, 0.2)]).map((wish) => wish.key)).toEqual(["fire-1"]);
  });
});

describe("sound keys", () => {
  it("names a fire by its entity id, as the dev state documents", () => {
    expect(soundKeys.fire(12)).toBe("fire-12");
  });

  it("names work by its kind and when it began, so work that starts again is a new sound", () => {
    expect(soundKeys.work("build", 10)).toBe("work-build-10000");
    expect(soundKeys.work("build", 11.2)).not.toBe(soundKeys.work("build", 10));
  });

  it("names each footstep and click by its number", () => {
    expect(soundKeys.footstep(3)).toBe("footstep-3");
    expect(soundKeys.place(2)).toBe("place-2");
  });
});
