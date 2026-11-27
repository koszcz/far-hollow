import type { CameraRig, CameraView } from "../render/camera-rig";
import { queued } from "../sim/api-commands";
import { type GameClient, type PlacingBlueprint } from "../sim/api-client";
import { type Plantable, type StructureKind } from "../sim/api";
import { type ScenePick, type ThingInReach } from "../sim/api-scene-pick";
import { modeAfterPlacing, NOT_BUILDING, pickBuildEntry, placeCommandFor, pressBuildKey, startSweep, type BuildMode, type Sweep } from "./build-mode";
import { plantCommandFor, plantUnderMouse, pressPlantKey, type PlantUnderMouse } from "./plant-mode";
import { actionsFor, mainAction, menuActions, type ActionReader, type ActionTarget, type ThingAction } from "./thing-actions";

/**
 * A thing's main action, if the player can do it now. E does it on the thing nearest the player.
 * On a finished structure, it is the main action of what is under it. A disabled main action does nothing.
 * A work station's main action, opening its menu, has no command. The caller opens the action menu for it instead.
 */
export function mainActionFor(pick: ScenePick, reader: ActionReader): ThingAction | undefined {
  const target = pick.kind === "structure" ? pick.under : pick;
  if (target === undefined) return undefined;
  const main = mainAction(actionsFor({ kind: "scene", pick: target }, reader));
  return main?.enabled === true ? main : undefined;
}

/**
 * What E does: the main action on the thing nearest the player within reach, if the player can do it now, with that thing.
 * With nothing in reach, or a main action that is off, E does nothing.
 * A work station's main action, opening its menu, has no command. The caller opens the action menu instead.
 */
export function useKeyFor(
  reader: ActionReader & Pick<GameClient, "nearestInReach">,
): { readonly thing: ThingInReach; readonly action: ThingAction } | undefined {
  const thing = reader.nearestInReach();
  if (thing === null) return undefined;
  const action = mainActionFor(thing, reader);
  return action === undefined ? undefined : { thing, action };
}

/**
 * What a click on a thing in the world opens: its action menu, main action first, or undefined if it offers nothing to send.
 * Ground opens no menu when walking is the only action the player can do there now, since a click there walks straight away.
 * This holds even when the ground lists other actions the game refuses, such as gathering stone while dragging a sled.
 * With a log on the shoulder, ground opens a menu to walk there or drop the log there.
 */
export function menuFor(pick: ScenePick, reader: ActionReader): readonly ThingAction[] | undefined {
  const actions = menuActions({ kind: "scene", pick }, reader);
  if (pick.kind === "ground" && actions.filter(({ enabled }) => enabled).length <= 1) return undefined;
  return actions.length === 0 ? undefined : actions;
}

/** What a menu on any target lists now: a thing in the world as `menuFor` decides, or a hotbar cell's actions. Undefined when it offers none. */
export function menuForTarget(target: ActionTarget, reader: ActionReader): readonly ThingAction[] | undefined {
  if (target.kind === "scene") return menuFor(target.pick, reader);
  const actions = menuActions(target, reader);
  return actions.length === 0 ? undefined : actions;
}

/** An action menu to show at a point on the page, in page pixels. */
export interface MenuRequest {
  readonly x: number;
  readonly y: number;
  /** True when the menu should sit wholly above the point, such as above a hotbar cell, rather than beside it. */
  readonly above?: boolean;
  /** What the menu is for. The menu reads its actions with `menuForTarget`, again after each logic step, so they stay current. */
  readonly target: ActionTarget;
}

/**
 * The CSS cursor to show for what is under the pointer.
 * A hand marks things the player can click. While placing a blueprint, a crosshair shows everywhere.
 * A finished structure shows the cursor for what is under it.
 */
export function cursorFor(pick: ScenePick | undefined, placing: boolean): string {
  if (placing) return "crosshair";
  if (pick?.kind === "structure") return cursorFor(pick.under, placing);
  if (pick === undefined || pick.kind === "ground") return "";
  return "pointer";
}

/**
 * What to outline for what is under the pointer: the same things that show a hand cursor, except the river.
 * The river is too big to outline. Nothing is outlined over the ground, or while placing a blueprint.
 */
export function outlineFor(pick: ScenePick | undefined, placing: boolean): ScenePick | undefined {
  if (pick?.kind === "structure") return outlineFor(pick.under, placing);
  if (pick?.kind === "river") return undefined;
  return cursorFor(pick, placing) === "pointer" ? pick : undefined;
}

function copyView(view: CameraView): CameraView {
  return { eye: { ...view.eye }, focus: { ...view.focus } };
}

function sameView(a: CameraView, b: CameraView): boolean {
  return a.eye.x === b.eye.x && a.eye.y === b.eye.y && a.eye.z === b.eye.z && a.focus.x === b.focus.x && a.focus.y === b.focus.y && a.focus.z === b.focus.z;
}

const LEFT_BUTTON = 0;
/** A left-button press that moves further than this is a drag, not a click. */
const CLICK_MAX_TRAVEL_PIXELS = 4;

export interface WalkInputOptions {
  readonly canvas: HTMLCanvasElement;
  readonly client: GameClient;
  readonly rig: CameraRig;
  /** What is under a point on the screen, if anything. */
  readonly pickAt: (clientX: number, clientY: number) => ScenePick | undefined;
  /** Called with what the player could click under the pointer, or undefined, so the scene can outline it. */
  readonly onHoverChange?: (pick: ScenePick | undefined) => void;
  /** Called when the build menu opens or closes, or placing a blueprint starts, turns, or ends, so the HUD can show it. */
  readonly onBuildModeChange?: (mode: BuildMode) => void;
  /** Called with the blueprint that should follow the mouse while placing, or undefined to hide it. */
  readonly onPlacingBlueprintChange?: (placing: PlacingBlueprint | undefined) => void;
  /**
   * Called when planting a sapling or berry bush starts, ends, or the see-through one moves. `planting` is what the player plants,
   * or undefined while not planting. `under` is the see-through one under the mouse, or undefined while the mouse is not over the ground.
   */
  readonly onPlantingChange?: (planting: Plantable | undefined, under: PlantUnderMouse | undefined) => void;
  /** Called with the menu a click on a thing opens, or undefined when it should close. */
  readonly onMenuChange?: (menu: MenuRequest | undefined) => void;
}

export interface WalkInput {
  /** Opens the build menu, or closes it if it is open. B does the same. */
  toggleBuildMenu(): void;
  /** Puts a structure's blueprint under the mouse. A click on the ground places it. R turns it. Escape cancels. */
  pickBuildEntry(structure: StructureKind): void;
  /** Puts a see-through sapling or berry bush under the mouse. A click on the ground where planting is allowed plants it there. Escape cancels. */
  startPlanting(plant: Plantable): void;
  /** Whether a Shift-drag is placing floors now. The camera does not pan while it does. */
  isSweeping(): boolean;
  /** Removes the listeners. */
  dispose(): void;
}

/**
 * A click on ground walks there when walking is the only action the player can do there now. With a log on the shoulder, it opens a menu to walk there or drop the log there instead. A click on a thing opens its action menu: a list of every action it offers, as `thing-actions.ts`
 * names them, with the main action on top. Picking one sends it, and the player walks to the thing first when needed.
 * A click on a finished structure opens its menu, which offers what is under it and taking it down.
 * Pressing Escape, or a click elsewhere, closes the menu. Escape also stops building.
 * B opens and closes the build menu. While placing a blueprint picked from it, the blueprint follows the mouse,
 * R turns it, a click on the ground places it, and Escape cancels. Placing a floor keeps build mode open on the floor.
 * While placing a floor, Shift and a left-drag place a floor blueprint on each foundation square the pointer crosses.
 * Any other left-drag pans the camera instead, so it never counts as a click. A right-drag turns the camera. A right-click does nothing.
 * While planting a sapling or berry bush, a see-through one follows the mouse, red where planting is not allowed. A click on the ground where it is allowed
 * plants it there, and Escape cancels.
 * Space snaps the camera back to the player.
 * E does the main action on the thing nearest the player within reach.
 */
export function attachWalkInput({
  canvas,
  client,
  rig,
  pickAt,
  onHoverChange,
  onBuildModeChange,
  onPlacingBlueprintChange,
  onPlantingChange,
  onMenuChange,
}: WalkInputOptions): WalkInput {
  let press: { x: number; y: number } | null = null;
  let mode: BuildMode = NOT_BUILDING;
  /** What follows the mouse, see-through, for the player to plant, or undefined while not planting. */
  let planting: Plantable | undefined;
  /** The Shift-drag placing floors now, if one is. */
  let sweep: Sweep | undefined;
  /** Where the pointer last was over the canvas, or null if it has left. */
  let hover: { x: number; y: number } | null = null;
  /** The animation frame that will update the cursor, if one is waiting. */
  let cursorFrame: number | null = null;
  /** The animation frame that checks for a moved camera or a changed game under a still pointer, while the pointer is over the canvas. */
  let watchFrame: number | null = null;
  /** Where the camera was when the cursor last updated. */
  let viewPicked: CameraView | null = null;
  /** Whether the game has changed since the cursor last updated, such as a thing being built or taken away. */
  let gameChanged = false;

  function updateCursor(): void {
    cursorFrame = null;
    viewPicked = copyView(rig.view());
    gameChanged = false;
    const seen = hover === null ? undefined : pickAt(hover.x, hover.y);
    // The cursor and outline show what is under a finished structure.
    const pick = seen?.kind === "structure" ? seen.under : seen;
    const placing = mode.placing !== null || planting !== undefined;
    const blueprint = placingBlueprintFor(pick);
    const under = planting === undefined ? undefined : plantUnderMouse(planting, seen, client);
    const refused = blueprint?.allowed === false || (under !== undefined && under.refusal !== null);
    canvas.style.cursor = refused ? "not-allowed" : cursorFor(pick, placing);
    onHoverChange?.(outlineFor(pick, placing));
    onPlacingBlueprintChange?.(blueprint);
    if (planting !== undefined) onPlantingChange?.(planting, under);
  }

  function setPlanting(value: Plantable | undefined): void {
    if (value === planting) return;
    planting = value;
    queueCursorUpdate();
    onPlantingChange?.(value, undefined);
  }

  /** The blueprint to show under the mouse while placing, snapped to the building grid. */
  function placingBlueprintFor(pick: ScenePick | undefined): PlacingBlueprint | undefined {
    if (mode.placing === null || pick?.kind !== "ground") return undefined;
    const { structure, turns } = mode.placing;
    // A roof takes the turn of the frame under it, so the placement check says which turn to show.
    return { structure, ...client.checkPlacement(structure, pick.spot, turns) };
  }

  /** Picking is a raycast, so the cursor updates at most once per frame. */
  function queueCursorUpdate(): void {
    if (cursorFrame === null) cursorFrame = requestAnimationFrame(updateCursor);
  }

  /**
   * The world can change under a still pointer: the camera pans or zooms, or the thing under it is built or taken away.
   * Each frame, this re-picks if either happened, so the cursor and outline always show what a click would act on.
   */
  function watchUnderPointer(): void {
    watchFrame = null;
    if (hover === null) return;
    if (gameChanged || viewPicked === null || !sameView(viewPicked, rig.view())) queueCursorUpdate();
    watchFrame = requestAnimationFrame(watchUnderPointer);
  }

  /** Places a blueprint where the pointer is, if a sweep is under way and the spot takes one. */
  function sweepAt(clientX: number, clientY: number): void {
    if (sweep === undefined) return;
    const seen = pickAt(clientX, clientY);
    // A blueprint is placed on what is under a finished structure, such as the ground under a foundation.
    const pick = seen?.kind === "structure" ? seen.under : seen;
    if (pick === undefined) return;
    for (const place of sweep.over(pick)) client.send(place);
  }

  function onPointerMove(event: PointerEvent): void {
    sweepAt(event.clientX, event.clientY);
    hover = { x: event.clientX, y: event.clientY };
    queueCursorUpdate();
    watchFrame ??= requestAnimationFrame(watchUnderPointer);
  }

  function onPointerLeave(): void {
    hover = null;
    queueCursorUpdate();
  }

  function setMode(value: BuildMode): void {
    if (value.menuOpen || value.placing !== null) setPlanting(undefined);
    mode = value;
    queueCursorUpdate();
    onBuildModeChange?.(value);
  }

  function onPointerDown(event: PointerEvent): void {
    // Any press on the scene closes an open menu.
    onMenuChange?.(undefined);
    if (event.button !== LEFT_BUTTON) return;
    if (event.shiftKey) sweep = startSweep(mode, client);
    if (sweep !== undefined) {
      sweepAt(event.clientX, event.clientY);
      return;
    }
    press = { x: event.clientX, y: event.clientY };
  }

  /** Opens the list of every action the thing offers beside a point on the page, if it offers any. */
  function showMenu(x: number, y: number, pick: ScenePick): void {
    if (menuFor(pick, client) !== undefined) onMenuChange?.({ x, y, target: { kind: "scene", pick } });
  }

  function onPointerUp(event: PointerEvent): void {
    if (event.button !== LEFT_BUTTON) return;
    // A sweep places its blueprints as the pointer moves. Letting go ends it. A sweep that never left its first spot was a click, so it places that blueprint now.
    const last = sweep?.end();
    sweep = undefined;
    if (last !== undefined) {
      client.send(last);
      setMode(modeAfterPlacing(mode, client.getView().buildMenu));
    }
    if (press === null) return;
    const travelled = Math.hypot(event.clientX - press.x, event.clientY - press.y);
    press = null;
    if (travelled > CLICK_MAX_TRAVEL_PIXELS) return;
    const seen = pickAt(event.clientX, event.clientY);
    if (planting !== undefined) {
      // A click where planting is not allowed does nothing, so the player can try another spot.
      const plant = plantCommandFor(plantUnderMouse(planting, seen, client));
      if (plant === undefined) return;
      client.send(plant);
      setPlanting(undefined);
      return;
    }
    if (seen === undefined) return;
    if (mode.placing !== null) {
      // A blueprint is placed on what is under a finished structure, such as the ground under a foundation.
      const pick = seen.kind === "structure" ? seen.under : seen;
      if (pick === undefined) return;
      // A click where the blueprint is not allowed does nothing, so the player can try another spot.
      if (placingBlueprintFor(pick)?.allowed !== true) return;
      const place = placeCommandFor(mode, pick);
      if (place === undefined) return;
      client.send(place);
      setMode(modeAfterPlacing(mode, client.getView().buildMenu));
      return;
    }
    if (seen.kind === "ground" && menuFor(seen, client) === undefined) {
      const walk = mainAction(actionsFor({ kind: "scene", pick: seen }, client));
      if (walk?.command !== undefined) client.send(walk.command);
      return;
    }
    showMenu(event.clientX, event.clientY, seen);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.code === "Escape") {
      onMenuChange?.(undefined);
      if (client.getView().action?.kind === "build") client.send({ type: "stopBuilding" });
    }
    if (event.repeat) return;
    // Let typing keep working in form fields, and Space keep pressing buttons.
    const target = event.target instanceof HTMLElement ? event.target : null;
    const typing = target?.closest("input, textarea, select") != null;
    if (planting !== undefined && pressPlantKey(event.code)) {
      setPlanting(undefined);
      return;
    }
    const next = event.code === "Escape" || !typing ? pressBuildKey(mode, event.code) : undefined;
    if (next !== undefined) {
      setMode(next);
      return;
    }
    if (event.code === "KeyE" && !typing && mode.placing === null && planting === undefined) {
      const use = useKeyFor(client);
      // Shift+E adds the main action to the end of the action queue.
      if (use?.action.command !== undefined) client.send(event.shiftKey ? queued(use.action.command) : use.action.command);
      else if (use?.action.id === "openMenu") {
        // E has no cursor spot to open the menu around, so it opens in the middle of the scene, where the player stands.
        const bounds = canvas.getBoundingClientRect();
        showMenu(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2, use.thing);
      }
      return;
    }
    if (event.code !== "Space" || target?.closest("input, textarea, select, button") != null) return;
    event.preventDefault();
    rig.snapToFollowTarget();
  }

  const unsubscribe = client.subscribe(() => {
    gameChanged = true;
  });
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);
  window.addEventListener("keydown", onKeyDown);
  return {
    toggleBuildMenu() {
      setMode(pressBuildKey(mode, "KeyB") ?? mode);
    },
    pickBuildEntry(structure) {
      setMode(pickBuildEntry(structure));
    },
    startPlanting(plant) {
      setMode(NOT_BUILDING);
      setPlanting(plant);
    },
    isSweeping() {
      return sweep !== undefined;
    },
    dispose() {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      if (cursorFrame !== null) cancelAnimationFrame(cursorFrame);
      if (watchFrame !== null) cancelAnimationFrame(watchFrame);
      unsubscribe();
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
