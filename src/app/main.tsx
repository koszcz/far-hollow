import { render } from "preact";
import { attachCameraInput } from "../render/camera-input";
import { CAMERA_FIELD_OF_VIEW_DEGREES, createSceneRenderer } from "../render/scene-renderer";
import { loadModelShapes } from "../render/model-shapes";
import { createFixedStepLoop } from "../sim/fixed-step-loop";
import type { Refusal } from "../sim/api";
import { createGame, STEP_MS, type Game } from "../sim/game";
import { continueOrStartGame, describeSave, writeSave } from "../sim/save";
import { randomSeed } from "../sim/seed";
import { clockMinutesOf } from "../sim/clock";
import { parseSeason, type Season } from "../sim/season";
import { strings } from "../strings";
import { DebugOverlay } from "../ui/debug-overlay";
import { ActionMenu } from "../ui/action-menu";
import { Hud } from "../ui/hud";
import type { PlantingHintState } from "../ui/hud-hints";
import { StartScreen } from "../ui/start-screen";
import { SoundButton } from "../ui/sound-button";
import { WallModeButton } from "../ui/cutaway-button";
import { nextWallMode, STARTING_WALL_MODE, type WallMode } from "../wall-mode";
import { createValleySound } from "../sound/valley-sound";
import { startAutosave } from "./autosave";
import { NOT_BUILDING, type BuildMode } from "./build-mode";
import { createDevHooks } from "./dev-hooks";
import { pressCraftKey } from "./craft-menu";
import { pressJournalKey } from "./journal-key";
import { hotbarKeyPlanting, pressHotbarKey } from "./hotbar";
import { downloadFile, saveExportFile, unreadableSlotExportFile } from "./save-export";
import { importIntoSlot } from "./save-import";
import { wireSound } from "./sound-wiring";
import { openSaveStorage, SAVE_SLOT_COUNT, type SaveStorage } from "./save-storage";
import type { ThingAction } from "./thing-actions";
import { attachWalkInput, menuForTarget, type MenuRequest } from "./walk-input";

/** Most logic steps one frame may run to catch up after a pause, such as a hidden tab. */
const MAX_STEPS_PER_FRAME = 10;

function requireElement<T extends Element>(selector: string, type: new () => T): T {
  const element = document.querySelector(selector);
  if (!(element instanceof type)) throw new Error(`Missing element ${selector}`);
  return element;
}

document.title = strings.gameTitle;

const { volumeControl, soundEngine } = wireSound();

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
  return new URLSearchParams(window.location.search).has("playground") || isInstantAddress();
}

/**
 * True if the address has `&instant`, as in `?playground&instant`. It starts the instant playground: every blueprint is finished
 * the moment it is placed, and every piece on the building grid is placed in rows, so a Shift-drag lays a row of foundations or walls.
 * Developers use it to put up a cabin fast. `?instant` on its own starts it too.
 */
function isInstantAddress(): boolean {
  return new URLSearchParams(window.location.search).has("instant");
}

/**
 * The season given as `&season=winter` in a playground address, if any. The playground then starts at the morning hour on day 1 of it.
 * Without it, the playground starts in spring.
 */
function playgroundSeason(): { startSeason?: Season } {
  if (!isPlaygroundAddress()) return {};
  const startSeason = parseSeason(new URLSearchParams(window.location.search).get("season"));
  return startSeason === undefined ? {} : { startSeason };
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

/** What one slot holds: its stored data, or the error the browser gave when it could not read the slot. */
type SlotContent = { readable: true; data: unknown } | { readable: false; error: unknown };

/** Reads the save in one slot. */
async function readSlot(storage: SaveStorage | undefined, slot: number): Promise<SlotContent> {
  if (storage === undefined) return { readable: true, data: undefined };
  try {
    return { readable: true, data: await storage.read(slot) };
  } catch (error) {
    console.warn(`Save slot ${slot + 1} could not be read.`, error);
    return { readable: false, error };
  }
}

/** The data a slot holds, as the game reads it. A slot that cannot be read holds `null`, so it counts as broken. */
function slotData(content: SlotContent | undefined): unknown {
  if (content === undefined) return undefined;
  return content.readable ? content.data : null;
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
    const showStartScreen = (): void => {
      render(
        <StartScreen
          slots={stored.map((content) => describeSave(slotData(content)))}
          canSave={storage !== undefined}
          onContinue={(slot) => {
            resolve({ game: continueOrStartGame(slotData(stored[slot]), randomSeed()), slot });
          }}
          onNewGame={(slot, seed) => {
            const game = createGame({ seed: seed ?? randomSeed() });
            // Save at once, so a new game started over a saved one replaces it even if the page closes soon after.
            saveToSlot(storage, slot, game);
            resolve({ game, slot });
          }}
          onExport={(slot) => {
            const content = stored[slot];
            if (content === undefined) return;
            const file = content.readable ? saveExportFile(slot, content.data) : unreadableSlotExportFile(slot, content.error);
            if (file !== undefined) downloadFile(file);
          }}
          onImport={async (slot, file) => {
            const imported = await importIntoSlot(storage, slot, await file.text());
            if (!imported.ok) return imported.reason;
            stored[slot] = { readable: true, data: imported.save };
            // Show the slot's new day and seed. Import does not start the game.
            showStartScreen();
            return undefined;
          }}
          volume={volumeControl}
        />,
        ui,
      );
    };
    showStartScreen();
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
    : {
        game: createGame({ seed: addressSeed ?? randomSeed(), freeBuilding: playground, instantBuilding: isInstantAddress(), ...playgroundSeason() }),
        slot: undefined,
      };
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
  () => game.client.getView().nightHours,
  () => clockMinutesOf(game.client.getView().time),
  () => game.client.getView().season,
  () => game.client.getView().afterFirstWinter,
  () => game.client.getView().lastSleep,
  () => game.client.getView().lastEatOrDrink,
  await loadModelShapes(),
);
const cameraInput = attachCameraInput({
  canvas,
  rig: sceneRenderer.cameraRig,
  fieldOfViewDegrees: CAMERA_FIELD_OF_VIEW_DEGREES,
  // A Shift-drag that places floors does not pan the camera.
  holdsPan: () => walkInput.isSweeping(),
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
  onPlacingBlueprintChange: (placing) => {
    sceneRenderer.showPlacingBlueprint(placing);
    // The HUD hint changes only when the reason does, so the HUD is not drawn again on every mouse move.
    const refusal = placing?.refusal;
    if (JSON.stringify(refusal) === JSON.stringify(uiState.placingRefusal)) return;
    uiState.placingRefusal = refusal;
    renderUi();
  },
  onPlantingChange: (planting, under) => {
    sceneRenderer.showPlanting(under && { plant: under.plant, spot: under.spot, allowed: under.refusal === null });
    // The HUD hint changes only when the reason does, so the HUD is not drawn again on every mouse move.
    const shown = planting === undefined ? undefined : { plant: planting, refusal: under?.refusal ?? null };
    if (JSON.stringify(shown) === JSON.stringify(uiState.planting)) return;
    uiState.planting = shown;
    renderUi();
  },
  onMenuChange: (menu) => {
    setMenu(menu);
    menuCameraView = menu === undefined ? null : cameraViewKey();
    renderUi();
  },
});
/** Runs one logic step. Returns false if the game held its logic instead. */
function runStep(): boolean {
  // Game logic waits while the player lies down, sleeps, and gets up, so they cannot act mid-sleep.
  if (sceneRenderer.isPlayingSleep()) return false;
  game.step();
  return true;
}
if (import.meta.env.DEV) {
  // Lets browser tests and agents read and drive the game, and run play time at once. Development builds only.
  Object.assign(window, { farHollow: createDevHooks(game.client, runStep, () => soundEngine.state()) });
}
const valleySound = createValleySound(soundEngine, game.valley, game.entities);
const loop = createFixedStepLoop({
  stepMs: STEP_MS,
  maxStepsPerAdvance: MAX_STEPS_PER_FRAME,
  step: runStep,
});

/**
 * Where the camera was when an action menu opened on a thing in the scene, or null if none is open.
 * The menu closes once the camera moves, since it would no longer sit beside its thing.
 */
let menuCameraView: string | null = null;

function cameraViewKey(): string {
  return JSON.stringify(sceneRenderer.cameraRig.view());
}

/** Reads the open action menu's actions now. Each menu gets its own function, so the menu keeps it while it is open. */
let readMenuActions: () => readonly ThingAction[] | undefined = () => undefined;
/** Counts opened menus, so a newly opened menu starts afresh rather than keeping the old one's state. */
let menuCount = 0;

function setMenu(menu: MenuRequest | undefined): void {
  uiState.menu = menu;
  if (menu === undefined) return;
  menuCount += 1;
  readMenuActions = () => menuForTarget(menu.target, game.client);
}

/** Closes the action menu, if one is open. */
function closeMenu(): void {
  if (uiState.menu === undefined) return;
  setMenu(undefined);
  menuCameraView = null;
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

/** Input state the UI shows: the build menu and placing, the craft menu, the journal panel, and the action menu, if one is open. */
const uiState: {
  buildMode: BuildMode;
  placingRefusal: Refusal | undefined;
  planting: PlantingHintState | undefined;
  craftMenuOpen: boolean;
  journalOpen: boolean;
  menu: MenuRequest | undefined;
  /** The wall mode the player has chosen with its HUD button. It is not saved. */
  wallMode: WallMode;
} = {
  buildMode: NOT_BUILDING,
  placingRefusal: undefined,
  planting: undefined,
  craftMenuOpen: false,
  journalOpen: false,
  menu: undefined,
  wallMode: STARTING_WALL_MODE,
};

function showNextWallMode(): void {
  uiState.wallMode = nextWallMode(uiState.wallMode);
  sceneRenderer.setWallMode(uiState.wallMode);
  renderUi();
}

function setJournalOpen(open: boolean): void {
  if (open === uiState.journalOpen) return;
  uiState.journalOpen = open;
  renderUi();
}

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
  const planting = hotbarKeyPlanting(event.code, game.client, { typing });
  if (planting !== undefined) walkInput.startPlanting(planting);
  const hotbarCommand = pressHotbarKey(event.code, game.client, { typing, shift: event.shiftKey });
  if (hotbarCommand !== undefined) game.client.send(hotbarCommand);
  if (event.code !== "Escape" && typing) return;
  const result = pressCraftKey(uiState.craftMenuOpen, event.code);
  if (result !== "ignore") setCraftMenuOpen(result === "open");
  const journal = pressJournalKey({ open: uiState.journalOpen, hasJournal: game.client.getView().journal !== null }, event.code);
  if (journal !== "ignore") setJournalOpen(journal === "open");
});

/** Draws the HUD, the action menu, and the debug overlay. Called again when the build mode or the action menu changes. */
function renderUi(): void {
  const { buildMode, menu } = uiState;
  render(
    <>
      {menu !== undefined && (
        <ActionMenu
          key={menuCount}
          client={game.client}
          x={menu.x}
          y={menu.y}
          above={menu.above ?? false}
          readActions={readMenuActions}
          onStartPlanting={(plant) => {
            walkInput.startPlanting(plant);
          }}
          onClose={closeMenu}
        />
      )}
      <Hud
        client={game.client}
        buildMenuOpen={buildMode.menuOpen}
        placing={buildMode.placing?.structure ?? null}
        placingRefusal={uiState.placingRefusal}
        planting={uiState.planting}
        onToggleBuildMenu={() => {
          walkInput.toggleBuildMenu();
        }}
        onPickBuildEntry={(structure) => {
          walkInput.pickBuildEntry(structure);
        }}
        craftMenuOpen={uiState.craftMenuOpen}
        journalOpen={uiState.journalOpen}
        onCloseJournal={() => {
          setJournalOpen(false);
        }}
        onToggleCraftMenu={() => {
          setCraftMenuOpen(!uiState.craftMenuOpen);
        }}
        onOpenHotbarMenu={(target, x, y) => {
          setMenu({ x, y, above: true, target });
          // A hotbar menu sits on the HUD, which stays put when the camera moves.
          menuCameraView = null;
          renderUi();
        }}
      />
      <WallModeButton mode={uiState.wallMode} onNext={showNextWallMode} />
      <SoundButton control={volumeControl} />
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
  valleySound.update(nowMs / 1000, {
    camera: sceneRenderer.cameraRig.view(),
    hourOfDay: sceneRenderer.drawnHourOfDay(),
    nightHours: sceneRenderer.drawnNightHours(),
    silence: sceneRenderer.sleepDarkness(),
    drawnPlayer: sceneRenderer.drawnPlayer(),
    asleep: sceneRenderer.isPlayingSleep(),
  });
  if (menuCameraView !== null && cameraViewKey() !== menuCameraView) closeMenu();
  if (isFirstFrame) hideLoadingScreen();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
