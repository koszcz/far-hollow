import { render } from "preact";
import { attachCameraInput } from "../render/camera-input";
import { CAMERA_FIELD_OF_VIEW_DEGREES, createSceneRenderer } from "../render/scene-renderer";
import { loadModelShapes } from "../render/model-shapes";
import { createFixedStepLoop } from "../sim/fixed-step-loop";
import { createGame, STEP_MS, type Game } from "../sim/game";
import { continueOrStartGame, describeSave, writeSave } from "../sim/save";
import { randomSeed } from "../sim/seed";
import { strings } from "../strings";
import { DebugOverlay } from "../ui/debug-overlay";
import { ActionMenu } from "../ui/action-menu";
import { Hud } from "../ui/hud";
import { StartScreen } from "../ui/start-screen";
import { startAutosave } from "./autosave";
import { NOT_BUILDING, type BuildMode } from "./build-mode";
import { openSaveStorage, SAVE_SLOT_COUNT, type SaveStorage } from "./save-storage";
import { attachWalkInput, type MenuRequest } from "./walk-input";

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
 * Developers use it to start a new game in the same valley again. It skips the start screen and is never saved.
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

/** Reads the save in one slot. A slot that cannot be read counts as broken. */
async function readSlot(storage: SaveStorage | undefined, slot: number): Promise<unknown> {
  if (storage === undefined) return undefined;
  try {
    return await storage.read(slot);
  } catch (error) {
    console.warn(`Save slot ${slot + 1} could not be read.`, error);
    return null;
  }
}

/** The game the player chose, and the save slot it saves to. A game started from `?seed=` has no slot and is not saved. */
interface ChosenGame {
  game: Game;
  slot: number | undefined;
}

/** Shows the start screen until the player continues a saved game or starts a new one. */
async function chooseGame(storage: SaveStorage | undefined): Promise<ChosenGame> {
  const stored = await Promise.all(Array.from({ length: SAVE_SLOT_COUNT }, (_, slot) => readSlot(storage, slot)));
  const ui = requireElement("#ui", HTMLDivElement);
  // The start screen replaces the loading screen until the player chooses.
  setLoadingScreenShown(false);
  const chosen = await new Promise<ChosenGame>((resolve) => {
    render(
      <StartScreen
        slots={stored.map(describeSave)}
        canSave={storage !== undefined}
        onContinue={(slot) => {
          resolve({ game: continueOrStartGame(stored[slot], randomSeed()), slot });
        }}
        onNewGame={(slot, seed) => {
          const game = createGame({ seed: seed ?? randomSeed() });
          // Save at once, so a new game started over a saved one replaces it even if the page closes soon after.
          saveToSlot(storage, slot, game);
          resolve({ game, slot });
        }}
      />,
      ui,
    );
  });
  render(null, ui);
  setLoadingScreenShown(true);
  return chosen;
}

function saveToSlot(storage: SaveStorage | undefined, slot: number, game: Game): void {
  storage?.write(slot, writeSave(game)).catch((error: unknown) => {
    console.warn("The game could not be saved.", error);
  });
}

/** Shows or hides the loading screen without removing it. */
function setLoadingScreenShown(shown: boolean): void {
  document.querySelector("#loading")?.classList.toggle("done", !shown);
}

const saveStorage = await tryOpenSaveStorage();
const addressSeed = seedFromAddress();
const { game, slot } = addressSeed === undefined ? await chooseGame(saveStorage) : { game: createGame({ seed: addressSeed }), slot: undefined };
if (saveStorage !== undefined && slot !== undefined) {
  startAutosave({
    save: () => {
      saveToSlot(saveStorage, slot, game);
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
  await loadModelShapes(),
);
const cameraInput = attachCameraInput({
  canvas,
  rig: sceneRenderer.cameraRig,
  fieldOfViewDegrees: CAMERA_FIELD_OF_VIEW_DEGREES,
  // The walk input is attached next. A drag only reads this after both exist.
  isLeftButtonBusy: () => walkInput.isHoldingBuild(),
});
const walkInput = attachWalkInput({
  canvas,
  client: game.client,
  rig: sceneRenderer.cameraRig,
  pickAt: (clientX, clientY) => sceneRenderer.pickAt(clientX, clientY),
  onHoverChange: (pick) => {
    sceneRenderer.setHovered(pick);
  },
  onBuildModeChange: (mode) => {
    uiState.buildMode = mode;
    renderUi();
  },
  onPreviewChange: (preview) => {
    sceneRenderer.setPlacementPreview(preview);
  },
  onMenuChange: (menu) => {
    uiState.menu = menu;
    renderUi();
  },
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

/** Input state the UI shows: the build menu and placing, and the right-click menu, if one is open. */
const uiState: { buildMode: BuildMode; menu: MenuRequest | undefined } = { buildMode: NOT_BUILDING, menu: undefined };

/** Draws the HUD, the right-click menu, and the debug overlay. Called again when the build mode or the right-click menu changes. */
function renderUi(): void {
  const { buildMode, menu } = uiState;
  render(
    <>
      {menu !== undefined && (
        <ActionMenu
          client={game.client}
          x={menu.x}
          y={menu.y}
          actions={menu.actions}
          onClose={() => {
            uiState.menu = undefined;
            renderUi();
          }}
        />
      )}
      <Hud
        client={game.client}
        cameraFollow={sceneRenderer.cameraRig.followEnabled}
        onCameraFollowChange={(enabled) => {
          sceneRenderer.cameraRig.setFollowEnabled(enabled);
        }}
        buildMenuOpen={buildMode.menuOpen}
        placing={buildMode.placing?.structure ?? null}
        onToggleBuildMenu={() => {
          walkInput.toggleBuildMenu();
        }}
        onPickBuildEntry={(structure) => {
          walkInput.pickBuildEntry(structure);
        }}
      />
      <DebugOverlay client={game.client} />
    </>,
    requireElement("#ui", HTMLDivElement),
  );
}
renderUi();

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
