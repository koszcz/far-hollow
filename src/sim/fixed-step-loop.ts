export interface FixedStepLoopOptions {
  /** Length of one logic step, in milliseconds. */
  stepMs: number;
  /** Most logic steps one advance may run, so a long pause cannot freeze the page. */
  maxStepsPerAdvance: number;
  /** Runs one logic step. */
  step: () => void;
}

export interface AdvanceResult {
  /** How many logic steps ran during this advance. */
  steps: number;
  /** How far, from 0 to just under 1, the time left over is through the next step. */
  alpha: number;
}

export interface FixedStepLoop {
  /** Adds real elapsed time and runs as many whole logic steps as fit. */
  advance(elapsedMs: number): AdvanceResult;
}

export function createFixedStepLoop(options: FixedStepLoopOptions): FixedStepLoop {
  const { stepMs, maxStepsPerAdvance, step } = options;
  let leftoverMs = 0;

  return {
    advance(elapsedMs) {
      leftoverMs += elapsedMs;
      let steps = 0;
      while (leftoverMs >= stepMs && steps < maxStepsPerAdvance) {
        step();
        leftoverMs -= stepMs;
        steps += 1;
      }
      if (leftoverMs >= stepMs) {
        // Drop time the loop cannot catch up on, so the game resumes instead of racing.
        leftoverMs = 0;
      }
      return { steps, alpha: leftoverMs / stepMs };
    },
  };
}
