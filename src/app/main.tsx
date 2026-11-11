import { render } from "preact";
import { createSceneRenderer } from "../render/scene-renderer";
import { createFixedStepLoop } from "../sim/fixed-step-loop";
import { createGame, STEP_MS } from "../sim/game";
import { strings } from "../strings";
import { Hud } from "../ui/hud";

/** Most logic steps one frame may run to catch up after a pause, such as a hidden tab. */
const MAX_STEPS_PER_FRAME = 10;

function requireElement<T extends Element>(selector: string, type: new () => T): T {
  const element = document.querySelector(selector);
  if (!(element instanceof type)) throw new Error(`Missing element ${selector}`);
  return element;
}

document.title = strings.gameTitle;

const game = createGame();
const sceneRenderer = createSceneRenderer(requireElement("#scene", HTMLCanvasElement), game.entities);
const loop = createFixedStepLoop({
  stepMs: STEP_MS, maxStepsPerAdvance: MAX_STEPS_PER_FRAME, step: () => {
    game.step();
  },
});

render(<Hud client={game.client} />, requireElement("#ui", HTMLDivElement));

let lastFrameMs: number | undefined;
function frame(nowMs: number): void {
  const { alpha } = loop.advance(lastFrameMs === undefined ? 0 : nowMs - lastFrameMs);
  lastFrameMs = nowMs;
  sceneRenderer.render(alpha);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
