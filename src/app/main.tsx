import { render } from "preact";
import { createSceneRenderer } from "../render/scene-renderer";
import { createFixedStepLoop } from "../sim/fixed-step-loop";
import { createGame, STEP_MS } from "../sim/game";
import { strings } from "../strings";
import { DebugOverlay } from "../ui/debug-overlay";
import { Hud } from "../ui/hud";

/** Most logic steps one frame may run to catch up after a pause, such as a hidden tab. */
const MAX_STEPS_PER_FRAME = 10;

function requireElement<T extends Element>(selector: string, type: new () => T): T {
  const element = document.querySelector(selector);
  if (!(element instanceof type)) throw new Error(`Missing element ${selector}`);
  return element;
}

document.title = strings.gameTitle;

/**
 * Until the new-game screen exists, each page load picks a random seed.
 * Developers can add `?seed=123` to the address to load the same valley again.
 */
function chooseSeed(): number {
  const fromAddress = Number.parseInt(new URLSearchParams(window.location.search).get("seed") ?? "", 10);
  if (Number.isSafeInteger(fromAddress)) return fromAddress >>> 0;
  return Math.floor(Math.random() * 2 ** 32);
}

const game = createGame({ seed: chooseSeed() });
const sceneRenderer = createSceneRenderer(
  requireElement("#scene", HTMLCanvasElement),
  game.valley,
  game.entities,
  () => game.client.getView().time.hourOfDay,
);
const loop = createFixedStepLoop({
  stepMs: STEP_MS, maxStepsPerAdvance: MAX_STEPS_PER_FRAME, step: () => {
    game.step();
  },
});

render(
  <>
    <Hud client={game.client} />
    <DebugOverlay client={game.client} />
  </>,
  requireElement("#ui", HTMLDivElement),
);

let lastFrameMs: number | undefined;
function frame(nowMs: number): void {
  const { alpha } = loop.advance(lastFrameMs === undefined ? 0 : nowMs - lastFrameMs);
  lastFrameMs = nowMs;
  sceneRenderer.render(alpha);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
