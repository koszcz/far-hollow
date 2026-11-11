import { describe, expect, it } from "vitest";
import { createFixedStepLoop } from "./fixed-step-loop";

function loopWithCounter(stepMs = 50, maxStepsPerAdvance = 5) {
  let stepsRun = 0;
  const loop = createFixedStepLoop({
    stepMs,
    maxStepsPerAdvance,
    step: () => {
      stepsRun += 1;
    },
  });
  return { loop, stepsRun: () => stepsRun };
}

describe("fixed-step loop", () => {
  it("runs one logic step when exactly one step of time passes", () => {
    const { loop, stepsRun } = loopWithCounter();
    const result = loop.advance(50);
    expect(stepsRun()).toBe(1);
    expect(result).toEqual({ steps: 1, alpha: 0 });
  });

  it("carries leftover time into the next advance and reports it as alpha", () => {
    const { loop, stepsRun } = loopWithCounter();
    expect(loop.advance(30)).toEqual({ steps: 0, alpha: 0.6 });
    expect(loop.advance(30)).toEqual({ steps: 1, alpha: 0.2 });
    expect(stepsRun()).toBe(1);
  });

  it("caps catch-up steps after a long pause and drops the extra time", () => {
    const { loop, stepsRun } = loopWithCounter(50, 5);
    expect(loop.advance(10_000)).toEqual({ steps: 5, alpha: 0 });
    expect(loop.advance(25)).toEqual({ steps: 0, alpha: 0.5 });
    expect(stepsRun()).toBe(5);
  });
});
