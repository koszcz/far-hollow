import { render } from "preact";
import { attachCameraInput } from "../render/camera-input";
import { CAMERA_FIELD_OF_VIEW_DEGREES, createSceneRenderer } from "../render/scene-renderer";
import { loadStumpShape } from "../render/stump-model";
import { loadTreeShapes } from "../render/tree-model";
import { createFixedStepLoop } from "../sim/fixed-step-loop";
import { createGame, STEP_MS, type Game } from "../sim/game";
import { continueOrStartGame, writeSave } from "../sim/save";
import { strings } from "../strings";
import { DebugOverlay } from "../ui/debug-overlay";
import { Hud } from "../ui/hud";
import { startAutosave } from "./autosave";
import { openSaveStorage, type SaveStorage } from "./save-storage";
import { attachWalkInput } from "./walk-input";

/** Most logic steps one frame may run to catch up after a pause, such as a hidden tab. */
const MAX_STEPS_PER_FRAME = 10;

function requireElement<T extends Element>(selector: string, type: new () => T): T {
  const element = document.querySelector(selector);
  if (!(element instanceof type)) throw new Error(`Missing element ${selector}`);
  return element;
}

document.title = strings.gameTitle;

/**
 * The seed given as `?seed=123` in the address, if any.
 * Developers use it to start a new game in the same valley again, in place of the saved game.
 */
function seedFromAddress(): number | undefined {
  const fromAddress = Number.parseInt(new URLSearchParams(window.location.search).get("seed") ?? "", 10);
  return Number.isSafeInteger(fromAddress) ? fromAddress >>> 0 : undefined;
}

/** How often the game saves itself while it runs, in real milliseconds. */
const AUTOSAVE_INTERVAL_MS = 30_000;

/** Opens the save database. Returns undefined if the browser will not store anything, such as in some private windows. */
async function tryOpenSaveStorage(): Promise<SaveStorage | undefined> {
  try {
    return await openSaveStorage();
  } catch (error) {
    console.warn("The game cannot be saved in this browser.", error);
    return undefined;
  }
}

/** Continues the saved game, or starts a new one. Until the new-game screen exists, a new game gets a random seed. */
async function loadGame(storage: SaveStorage | undefined): Promise<Game> {
  const addressSeed = seedFromAddress();
  if (addressSeed !== undefined) return createGame({ seed: addressSeed });
  const stored = await storage?.read().catch((error: unknown) => {
    console.warn("The saved game could not be read.", error);
    return null;
  });
  return continueOrStartGame(stored, Math.floor(Math.random() * 2 ** 32));
}

const saveStorage = await tryOpenSaveStorage();
const game = await loadGame(saveStorage);
if (saveStorage !== undefined) {
  startAutosave({
    save: () => {
      saveStorage.write(writeSave(game)).catch((error: unknown) => {
        console.warn("The game could not be saved.", error);
      });
    },
    intervalMs: AUTOSAVE_INTERVAL_MS,
    page: window,
    isHidden: () => document.visibilityState === "hidden",
  });
}
const canvas = requireElement("#scene", HTMLCanvasElement);
const sceneRenderer = createSceneRenderer(
  canvas,
  game.valley,
  game.entities,
  () => game.client.getView().time.hourOfDay,
  ...(await Promise.all([loadTreeShapes(), loadStumpShape()])),
);
const cameraInput = attachCameraInput({
  canvas, rig: sceneRenderer.cameraRig, fieldOfViewDegrees: CAMERA_FIELD_OF_VIEW_DEGREES,
});
const walkInput = attachWalkInput({
  canvas,
  client: game.client,
  rig: sceneRenderer.cameraRig,
  pickAt: (clientX, clientY) => sceneRenderer.pickAt(clientX, clientY),
  onHoverChange: (pick) => {
    sceneRenderer.setHovered(pick);
  },
  onPlacingChange: renderUi,
});
if (import.meta.env.DEV) {
  // Lets the on-demand browser test read the game's view. Development builds only.
  Object.assign(window, { farHollow: { client: game.client } });
}
const loop = createFixedStepLoop({
  stepMs: STEP_MS, maxStepsPerAdvance: MAX_STEPS_PER_FRAME, step: () => {
    game.step();
  },
});

/** Draws the HUD and debug overlay. Called again when placing a campfire starts or ends. */
function renderUi(placingCampfire: boolean): void {
  render(
    <>
      <Hud
        client={game.client}
        cameraFollow={sceneRenderer.cameraRig.followEnabled}
        onCameraFollowChange={(enabled) => {
          sceneRenderer.cameraRig.setFollowEnabled(enabled);
        }}
        placingCampfire={placingCampfire}
        onPlaceCampfire={() => {
          walkInput.startPlacingCampfire();
        }}
      />
      <DebugOverlay client={game.client} />
    </>,
    requireElement("#ui", HTMLDivElement),
  );
}
renderUi(false);

/** How long the loading screen takes to fade out. Matches the transition in style.css. */
const LOADING_FADE_MS = 400;

/**
 * Fades out the loading screen, then removes it.
 * A timer removes it, not `transitionend`, because background tabs pause transitions.
 */
function hideLoadingScreen(): void {
  const loading = document.querySelector("#loading");
  if (!loading) return;
  loading.classList.add("done");
  setTimeout(() => {
    loading.remove();
  }, LOADING_FADE_MS);
}

let lastFrameMs: number | undefined;
function frame(nowMs: number): void {
  const isFirstFrame = lastFrameMs === undefined;
  const elapsedMs = lastFrameMs === undefined ? 0 : nowMs - lastFrameMs;
  const { alpha } = loop.advance(elapsedMs);
  lastFrameMs = nowMs;
  cameraInput.update(elapsedMs / 1000);
  sceneRenderer.render(alpha);
  if (isFirstFrame) hideLoadingScreen();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
