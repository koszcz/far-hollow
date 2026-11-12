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
import { pressCraftKey } from "./craft-menu";
import { pressHotbarKey } from "./hotbar";
import { openSaveStorage, SAVE_SLOT_COUNT, type SaveStorage } from "./save-storage";
import { attachCursorPrompt } from "./cursor-prompt-overlay";
import { menuActions } from "./thing-actions";
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

/**
 * True if the address has `?playground`. It starts a new game, skipping the start screen, where building costs nothing.
 * Developers use it to try out building. Add `&seed=123` to pick the valley. A playground game is never saved.
 */
function isPlaygroundAddress(): boolean {
  return new URLSearchParams(window.location.search).has("playground");
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
const playground = isPlaygroundAddress();
const { game, slot } =
  addressSeed === undefined && !playground
    ? await chooseGame(saveStorage)
    : { game: createGame({ seed: addressSeed ?? randomSeed(), freeBuilding: playground }), slot: undefined };
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
  () => game.client.getView().lastSleep,
  await loadModelShapes(),
);
const cameraInput = attachCameraInput({
  canvas,
  rig: sceneRenderer.cameraRig,
  fieldOfViewDegrees: CAMERA_FIELD_OF_VIEW_DEGREES,
});
const cursorPrompt = attachCursorPrompt(game.client);
const walkInput = attachWalkInput({
  canvas,
  client: game.client,
  rig: sceneRenderer.cameraRig,
  pickAt: (clientX, clientY) => sceneRenderer.pickAt(clientX, clientY),
  onHoverChange: (pick) => {
    sceneRenderer.setHovered(pick);
  },
  onPromptTargetChange: (pick) => {
    cursorPrompt.setSceneTarget(pick);
  },
  onBuildModeChange: (mode) => {
    uiState.buildMode = mode;
    renderUi();
  },
  onPlacingBlueprintChange: (placing) => {
    sceneRenderer.showPlacingBlueprint(placing);
  },
  onMenuChange: (menu) => {
    uiState.menu = menu;
    menuCameraView = menu === undefined ? null : cameraViewKey();
    cursorPrompt.setHidden(menu !== undefined);
    renderUi();
  },
});
if (import.meta.env.DEV) {
  // Lets the on-demand browser test read the game's view. Development builds only.
  Object.assign(window, { farHollow: { client: game.client } });
}
const loop = createFixedStepLoop({
  stepMs: STEP_MS,
  maxStepsPerAdvance: MAX_STEPS_PER_FRAME,
  step: () => {
    // Game logic waits while the player lies down, sleeps, and gets up, so they cannot act mid-sleep.
    if (!sceneRenderer.isPlayingSleep()) game.step();
  },
});

/**
 * Where the camera was when an action menu opened on a thing in the scene, or null if none is open.
 * The menu closes once the camera moves, since it would no longer sit beside its thing.
 */
let menuCameraView: string | null = null;

function cameraViewKey(): string {
  return JSON.stringify(sceneRenderer.cameraRig.view());
}

/** Closes the action menu, if one is open. */
function closeMenu(): void {
  if (uiState.menu === undefined) return;
  uiState.menu = undefined;
  menuCameraView = null;
  cursorPrompt.setHidden(false);
  renderUi();
}

// The action menu sits at a fixed spot on the page, so it closes when the window resizes.
window.addEventListener("resize", closeMenu);

// A HUD button clicked with the mouse lets go of focus, so Space and Enter go back to the game instead of pressing it again.
// Buttons pressed from the keyboard keep focus, so keyboard players can carry on.
document.addEventListener("click", (event) => {
  const button = event.target instanceof Element ? event.target.closest("button") : null;
  if (event.detail > 0 && button instanceof HTMLButtonElement) button.blur();
});

/** Input state the UI shows: the build menu and placing, the craft menu, and the action menu, if one is open. */
const uiState: { buildMode: BuildMode; craftMenuOpen: boolean; menu: MenuRequest | undefined } = {
  buildMode: NOT_BUILDING,
  craftMenuOpen: false,
  menu: undefined,
};

function setCraftMenuOpen(open: boolean): void {
  if (open === uiState.craftMenuOpen) return;
  uiState.craftMenuOpen = open;
  renderUi();
}

window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  // Let typing keep working in form fields.
  const target = event.target instanceof HTMLElement ? event.target : null;
  const typing = target?.closest("input, textarea, select") != null;
  const hotbarCommand = pressHotbarKey(event.code, game.client, { typing });
  if (hotbarCommand !== undefined) game.client.send(hotbarCommand);
  if (event.code !== "Escape" && typing) return;
  const result = pressCraftKey(uiState.craftMenuOpen, event.code);
  if (result !== "ignore") setCraftMenuOpen(result === "open");
});

/** Draws the HUD, the action menu, and the debug overlay. Called again when the build mode or the action menu changes. */
function renderUi(): void {
  const { buildMode, menu } = uiState;
  render(
    <>
      {menu !== undefined && <ActionMenu client={game.client} x={menu.x} y={menu.y} above={menu.above ?? false} actions={menu.actions} onClose={closeMenu} />}
      <Hud
        client={game.client}
        buildMenuOpen={buildMode.menuOpen}
        placing={buildMode.placing?.structure ?? null}
        onToggleBuildMenu={() => {
          walkInput.toggleBuildMenu();
        }}
        onPickBuildEntry={(structure) => {
          walkInput.pickBuildEntry(structure);
        }}
        craftMenuOpen={uiState.craftMenuOpen}
        onToggleCraftMenu={() => {
          setCraftMenuOpen(!uiState.craftMenuOpen);
        }}
        onOpenHotbarMenu={(target, x, y) => {
          uiState.menu = { x, y, above: true, actions: menuActions(target, game.client) };
          cursorPrompt.setHidden(true);
          // A hotbar menu sits on the HUD, which stays put when the camera moves.
          menuCameraView = null;
          renderUi();
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
  if (menuCameraView !== null && cameraViewKey() !== menuCameraView) closeMenu();
  if (isFirstFrame) hideLoadingScreen();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
