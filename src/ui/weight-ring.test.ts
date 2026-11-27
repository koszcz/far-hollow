import { describe, expect, it } from "bun:test";
import { backpackText } from "../strings/backpack";
import { NEARLY_FULL, weightRingShare, weightRingWarns } from "./weight-ring";

describe("a weight ring", () => {
  it("fills with the weight as a share of the limit", () => {
    expect(weightRingShare(0, 20)).toBe(0);
    expect(weightRingShare(5, 20)).toBe(0.25);
    expect(weightRingShare(20, 20)).toBe(1);
  });

  it("stays full when the weight goes over the limit", () => {
    expect(weightRingShare(25, 20)).toBe(1);
    expect(weightRingShare(0, 0)).toBe(1);
  });

  it("warns at 90% of the limit or more, the threshold the old weight text used", () => {
    expect(NEARLY_FULL).toBe(0.9);
    expect(weightRingWarns(0, 20)).toBe(false);
    expect(weightRingWarns(17.9, 20)).toBe(false);
    expect(weightRingWarns(18, 20)).toBe(true);
    expect(weightRingWarns(20, 20)).toBe(true);
    expect(weightRingWarns(54, 60)).toBe(true);
  });

  it("labels the exact weight, to one decimal place at most", () => {
    expect(backpackText.weightOf(5.5, 20)).toBe("5.5 of 20 kg");
    expect(backpackText.weightOf(0, 20)).toBe("0 of 20 kg");
    expect(backpackText.weightOf(0.1 + 0.2, 60)).toBe("0.3 of 60 kg");
  });
});
