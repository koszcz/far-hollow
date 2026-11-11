import { render } from "preact";
import { attachCameraInput } from "../render/camera-input";
import { CAMERA_FIELD_OF_VIEW_DEGREES, createSceneRenderer } from "../render/scene-renderer";
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
const canvas = requireElement("#scene", HTMLCanvasElement);
const sceneRenderer = createSceneRenderer(canvas, game.valley, game.entities);
const cameraInput = attachCameraInput({
  canvas, rig: sceneRenderer.cameraRig, fieldOfViewDegrees: CAMERA_FIELD_OF_VIEW_DEGREES,
});
const loop = createFixedStepLoop({
  stepMs: STEP_MS, maxStepsPerAdvance: MAX_STEPS_PER_FRAME, step: () => {
    game.step();
  },
});

render(
  <Hud
    client={game.client}
    cameraFollow={sceneRenderer.cameraRig.followEnabled}
    onCameraFollowChange={(enabled) => {
      sceneRenderer.cameraRig.setFollowEnabled(enabled);
    }}
  />,
  requireElement("#ui", HTMLDivElement),
);

let lastFrameMs: number | undefined;
function frame(nowMs: number): void {
  const elapsedMs = lastFrameMs === undefined ? 0 : nowMs - lastFrameMs;
  const { alpha } = loop.advance(elapsedMs);
  lastFrameMs = nowMs;
  cameraInput.update(elapsedMs / 1000);
  sceneRenderer.render(alpha);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
