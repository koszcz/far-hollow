import { describe, expect, it } from "bun:test";
import { STRIDE_METRES } from "../render/player-timing";
import { createActionSounds, FOOT_DOWN_SHARE, FOOTSTEP_SECONDS, PLACE_SECONDS, WORK_RHYTHMS, type PlayerSoundsNow } from "./action-sounds";
import type { DrawnWork } from "../render/drawn-work";
import { listenerFrom } from "./listener";

const SPOT = { x: 5, z: 5 };
const LISTENER = listenerFrom(SPOT, { eye: { x: 5, z: -5 }, focus: SPOT });

function now(changes: Partial<PlayerSoundsNow> = {}): PlayerSoundsNow {
  return { spot: SPOT, clicks: 0, asleep: false, ...changes };
}

describe("work sounds", () => {
  const SOUNDS: readonly (readonly [DrawnWork, string])[] = [
    ["chop", "sound-chop"],
    ["saw", "sound-saw"],
    ["debark", "sound-debark"],
    ["digUp", "sound-dig"],
    ["build", "sound-build"],
  ];
  for (const [kind, sound] of SOUNDS) {
    it(`${kind} plays ${sound} from the player's spot`, () => {
      const wishes = createActionSounds().wishes(LISTENER, now({ work: { kind, since: 10 } }), 10.2);
      expect(wishes).toHaveLength(1);
      expect(wishes[0]).toMatchObject({ sound, pan: 0 });
      expect(wishes[0]?.loudness).toBeGreaterThan(0);
    });

    it(`${kind} stops as soon as the work stops`, () => {
      const sounds = createActionSounds();
      sounds.wishes(LISTENER, now({ work: { kind, since: 10 } }), 10.2);
      expect(sounds.wishes(LISTENER, now(), 10.3)).toEqual([]);
    });
  }

  it("plays nothing while the player stands idle", () => {
    expect(createActionSounds().wishes(LISTENER, now(), 3)).toEqual([]);
  });

  it("starts each sound where the work's rhythm is now, so it plays in time with the motion", () => {
    const wishes = createActionSounds().wishes(LISTENER, now({ work: { kind: "debark", since: 10 } }), 10.25);
    expect(wishes[0]?.startAt).toBeCloseTo(0.25);
    // Debarking strokes last 1.5 s, so 2 s in is half a second into the second stroke.
    const later = createActionSounds().wishes(LISTENER, now({ work: { kind: "debark", since: 10 } }), 12);
    expect(later[0]?.startAt).toBeCloseTo(0.5);
  });

  it("times chopping by the clock, as the chop clip is", () => {
    // One swing lasts 1.1 s, and the swing clip runs on the clock, not from when chopping began: 11.2 s is 0.2 s past the tenth swing.
    const wishes = createActionSounds().wishes(LISTENER, now({ work: { kind: "chop", since: 10 } }), 11.2);
    expect(wishes[0]?.startAt).toBeCloseTo(0.2);
  });

  it("starts a new sound when the work starts again, so it keeps in time with the new motion", () => {
    const sounds = createActionSounds();
    const first = sounds.wishes(LISTENER, now({ work: { kind: "build", since: 10 } }), 11);
    sounds.wishes(LISTENER, now(), 11.1);
    const again = sounds.wishes(LISTENER, now({ work: { kind: "build", since: 11.2 } }), 11.3);
    expect(again[0]?.key).not.toBe(first[0]?.key);
  });

  it("plays nothing while the player sleeps", () => {
    expect(createActionSounds().wishes(LISTENER, now({ work: { kind: "chop", since: 10 }, asleep: true }), 10.2)).toEqual([]);
  });
});

describe("footsteps", () => {
  /** Metres walked when the left foot comes down in the walk's second loop. */
  const LEFT_FOOT_DOWN = (1 + FOOT_DOWN_SHARE) * STRIDE_METRES;

  it("plays one footstep each time a foot comes down, in time with the walk", () => {
    const sounds = createActionSounds();
    expect(sounds.wishes(LISTENER, now({ walkedMetres: LEFT_FOOT_DOWN - 0.01 }), 1)).toEqual([]);
    const left = sounds.wishes(LISTENER, now({ walkedMetres: LEFT_FOOT_DOWN + 0.01 }), 1.02);
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ sound: "sound-footstep", startAt: 0, pan: 0 });
    // The right foot comes down half a stride later, as a new footstep.
    const right = sounds.wishes(LISTENER, now({ walkedMetres: LEFT_FOOT_DOWN + STRIDE_METRES / 2 + 0.01 }), 1.3);
    expect(right).toHaveLength(1);
    expect(right[0]?.key).not.toBe(left[0]?.key);
  });

  it("lets a footstep ring out briefly, then stops it", () => {
    const sounds = createActionSounds();
    sounds.wishes(LISTENER, now({ walkedMetres: LEFT_FOOT_DOWN - 0.01 }), 1);
    sounds.wishes(LISTENER, now({ walkedMetres: LEFT_FOOT_DOWN + 0.01 }), 1.02);
    expect(sounds.wishes(LISTENER, now({ walkedMetres: LEFT_FOOT_DOWN + 0.02 }), 1.02 + FOOTSTEP_SECONDS)).toEqual([]);
  });

  it("stops as soon as the player stops walking", () => {
    const sounds = createActionSounds();
    sounds.wishes(LISTENER, now({ walkedMetres: LEFT_FOOT_DOWN - 0.01 }), 1);
    sounds.wishes(LISTENER, now({ walkedMetres: LEFT_FOOT_DOWN + 0.01 }), 1.02);
    expect(sounds.wishes(LISTENER, now(), 1.05)).toEqual([]);
  });

  it("plays no footstep for where the walk starts", () => {
    expect(createActionSounds().wishes(LISTENER, now({ walkedMetres: LEFT_FOOT_DOWN + 0.01 }), 1)).toEqual([]);
  });

  it("plays footsteps over work drawn at the same time, such as stepping up to the sawhorse", () => {
    const sounds = createActionSounds();
    sounds.wishes(LISTENER, now({ work: { kind: "saw", since: 1 }, walkedMetres: LEFT_FOOT_DOWN - 0.01 }), 1);
    const both = sounds.wishes(LISTENER, now({ work: { kind: "saw", since: 1 }, walkedMetres: LEFT_FOOT_DOWN + 0.01 }), 1.02);
    expect(both.map((wish) => wish.sound)).toEqual(["sound-saw", "sound-footstep"]);
  });
});

describe("the place click", () => {
  it("plays a short, quiet click when a blueprint is placed or a piece taken down", () => {
    const sounds = createActionSounds();
    const clicked = sounds.wishes(LISTENER, now({ clicks: 1 }), 2);
    expect(clicked).toHaveLength(1);
    expect(clicked[0]).toMatchObject({ sound: "sound-place", startAt: 0 });
    expect(clicked[0]?.loudness).toBeLessThan(WORK_RHYTHMS.chop.loudness);
    expect(sounds.wishes(LISTENER, now(), 2 + PLACE_SECONDS)).toEqual([]);
  });

  it("plays each click as a new sound", () => {
    const sounds = createActionSounds();
    const first = sounds.wishes(LISTENER, now({ clicks: 1 }), 2);
    const second = sounds.wishes(LISTENER, now({ clicks: 1 }), 2.05);
    expect(second[0]?.key).not.toBe(first[0]?.key);
  });

  it("does not play while the player sleeps", () => {
    expect(createActionSounds().wishes(LISTENER, now({ clicks: 1, asleep: true }), 2)).toEqual([]);
  });
});
