import { describe, expect, it } from "bun:test";
import {
  SIT_DOWN_SECONDS,
  SIT_SEAT_CONTACT_METRES,
  SIT_SEATED_AT,
  SIT_SINK_METRES,
  SIT_STEP_ON_SECONDS,
  sitBodyAt,
  sitSinkAt,
  standBodyAt,
  standSecondsAfter,
  standSinkAt,
  STAND_SECONDS,
} from "./sit-animation";
import { STOOL_SEAT_TOP_METRES } from "./stool-meshes";

describe("the sit animation", () => {
  it("rests the seated body on the stool's seat", () => {
    expect(SIT_SEAT_CONTACT_METRES - SIT_SINK_METRES).toBeCloseTo(STOOL_SEAT_TOP_METRES, 5);
    expect(sitSinkAt(SIT_SEATED_AT)).toBeCloseTo(SIT_SINK_METRES, 5);
  });

  it("goes from sitting down into resting without a jump", () => {
    const lastDown = sitBodyAt(SIT_SEATED_AT - 0.0001);
    expect(lastDown.clip).toBe("sitDown");
    expect(lastDown.clipSeconds).toBeCloseTo(SIT_DOWN_SECONDS, 3);
    expect(sitBodyAt(SIT_SEATED_AT)).toEqual({ clip: "sitIdle", clipSeconds: 0 });
  });

  it("stands a seated player up with the whole stand-up clip, from the seated height", () => {
    const seatedFor = SIT_SEATED_AT + 3;
    expect(standSecondsAfter(seatedFor)).toBe(STAND_SECONDS);
    expect(standBodyAt(0, seatedFor)).toEqual({ clip: "standUp", clipSeconds: 0 });
    expect(standSinkAt(0, seatedFor)).toBeCloseTo(sitSinkAt(seatedFor), 5);
  });

  it("plays sitting down backwards from where it was when the player stands mid-sit", () => {
    const seatedFor = SIT_STEP_ON_SECONDS + SIT_DOWN_SECONDS / 2;
    const sat = sitBodyAt(seatedFor);
    expect(standBodyAt(0, seatedFor)).toEqual(sat);
    expect(standSinkAt(0, seatedFor)).toBeCloseTo(sitSinkAt(seatedFor), 5);
    const rising = standBodyAt(SIT_DOWN_SECONDS / 4, seatedFor);
    expect(rising?.clip).toBe("sitDown");
    expect(rising?.clipSeconds).toBeCloseTo(SIT_DOWN_SECONDS / 4, 5);
    expect(standBodyAt(SIT_DOWN_SECONDS / 2 + 0.001, seatedFor)).toBeUndefined();
    expect(standSinkAt(SIT_DOWN_SECONDS / 2, seatedFor)).toBeCloseTo(0, 5);
  });

  it("steps straight back when the player stands before sitting down began", () => {
    expect(standBodyAt(0, SIT_STEP_ON_SECONDS / 2)).toBeUndefined();
    expect(standSinkAt(0, SIT_STEP_ON_SECONDS / 2)).toBe(0);
  });
});
