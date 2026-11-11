import { describe, expect, it } from "vitest";
import { catchSickness, passSicknessTime, SICKNESS_MINUTES } from "./sickness";

const ACTIVE = { resting: false };
const RESTING = { resting: true };

describe("sickness", () => {
  it("wears off after one day for a player who keeps busy", () => {
    const sickness = catchSickness();

    expect(passSicknessTime(sickness, 23 * 60, ACTIVE)).toBe(false);
    expect(passSicknessTime(sickness, 60, ACTIVE)).toBe(true);
  });

  it("wears off twice as fast while the player rests", () => {
    const sickness = catchSickness();

    expect(passSicknessTime(sickness, 11 * 60, RESTING)).toBe(false);
    expect(passSicknessTime(sickness, 60, RESTING)).toBe(true);
  });

  it("starts over at a full day when the player catches it again", () => {
    const sickness = catchSickness();
    passSicknessTime(sickness, 20 * 60, ACTIVE);

    const caughtAgain = catchSickness();

    expect(caughtAgain.minutesLeft).toBe(SICKNESS_MINUTES);
    expect(passSicknessTime(caughtAgain, 20 * 60, ACTIVE)).toBe(false);
  });
});
