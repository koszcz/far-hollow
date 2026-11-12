import type { CameraRig } from "../render/camera-rig";
import type { GroundOrThingPick, PlacingBlueprint, ScenePick } from "../render/scene-renderer";
import type { GameClient, StructureKind, ThingInReach } from "../sim/api";
import { NOT_BUILDING, pickBuildEntry, placeCommandFor, pressBuildKey, type BuildMode } from "./build-mode";
import { actionsFor, hasMoreActions, leftClickAction, mainAction, type ActionReader, type ThingAction } from "./thing-actions";

/**
 * What a left-click on a thing does: its main action, if the player can do it now.
 * A click on a finished structure acts on what is under it. A disabled main action does nothing, since the cursor prompt already says why.
 * A work station's main action, opening its menu, has no command. The caller opens the action menu for it instead.
 */
export function leftClickFor(pick: ScenePick, reader: ActionReader): ThingAction | undefined {
  const target = pick.kind === "structure" ? pick.under : pick;
  if (target === undefined) return undefined;
  const main = mainAction(actionsFor({ kind: "scene", pick: target }, reader));
  return main?.enabled === true ? main : undefined;
}

/**
 * What E does: the main action on the thing nearest the player within reach, if the player can do it now, with that thing.
 * With nothing in reach, or a main action that is off, E does nothing.
 * A work station's main action, opening its menu, has no command. The caller opens the menu, as for a left-click.
 */
export function useKeyFor(
  reader: ActionReader & Pick<GameClient, "nearestInReach">,
): { readonly thing: ThingInReach; readonly action: ThingAction } | undefined {
  const thing = reader.nearestInReach();
  if (thing === null) return undefined;
  const action = leftClickFor(thing, reader);
  return action === undefined ? undefined : { thing, action };
}

/**
 * The actions an action menu lists for a thing, main first, or undefined if the menu should not open.
 * It opens whenever the thing offers an action a left-click does not do, such as taking down a lone wall.
 */
export function menuFor(pick: ScenePick, reader: ActionReader): readonly ThingAction[] | undefined {
  const target = { kind: "scene", pick } as const;
  const actions = actionsFor(target, reader);
  return hasMoreActions(actions, leftClickAction(target, reader)) ? actions : undefined;
}

/** An action menu to show at a point on the page, in page pixels. */
export interface MenuRequest {
  readonly x: number;
  readonly y: number;
  /** Every action the thing offers, main first. */
  readonly actions: readonly ThingAction[];
}

/**
 * The CSS cursor to show for what is under the pointer.
 * A hand marks things the player can click. While placing a blueprint, a crosshair shows everywhere.
 * A finished structure shows the cursor for what is under it, since a left-click acts on that.
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

const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;
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
  /** Called with what is under the pointer, finished structures included, so the cursor prompt can describe it. Undefined while placing a blueprint. */
  readonly onPromptTargetChange?: (pick: ScenePick | undefined) => void;
  /** Called when the build menu opens or closes, or placing a blueprint starts, turns, or ends, so the HUD can show it. */
  readonly onBuildModeChange?: (mode: BuildMode) => void;
  /** Called with the blueprint that should follow the mouse while placing, or undefined to hide it. */
  readonly onPlacingBlueprintChange?: (placing: PlacingBlueprint | undefined) => void;
  /** Called with the menu a right-click opens, or undefined when it should close. */
  readonly onMenuChange?: (menu: MenuRequest | undefined) => void;
}

export interface WalkInput {
  /** Opens the build menu, or closes it if it is open. B does the same. */
  toggleBuildMenu(): void;
  /** Puts a structure's blueprint under the mouse. A left-click on the ground places it. R turns it. Escape cancels. */
  pickBuildEntry(structure: StructureKind): void;
  /** Removes the listeners. */
  dispose(): void;
}

/**
 * Left-clicking does the main action for what is under the pointer, as `thing-actions.ts` names it.
 * For example, it walks to a spot on the ground, chops a tree, lights or feeds a campfire, or stacks the carried log on a woodpile.
 * The player walks to the thing first when needed. A left-click on a work station opens its menu of recipes.
 * Clicking a blueprint starts building it, or adds the carried material it still needs. Clicking anywhere else, or pressing Escape, stops building.
 * B opens and closes the build menu. While placing a blueprint picked from it, the blueprint follows the mouse,
 * R turns it, a left-click on the ground places it, and Escape cancels.
 * A left-drag pans the camera instead, so it never counts as a click.
 * A right-click without a drag opens a menu of every action the thing offers, such as debarking a log or taking down a structure.
 * It opens for things that offer any action a left-click does not do.
 * Only the action menu sees finished structures. Other clicks act on what is under them.
 * A right-drag turns the camera instead.
 * Space snaps the camera back to the player.
 * E does the main action on the thing nearest the player within reach.
 */
export function attachWalkInput({
  canvas,
  client,
  rig,
  pickAt,
  onHoverChange,
  onPromptTargetChange,
  onBuildModeChange,
  onPlacingBlueprintChange,
  onMenuChange,
}: WalkInputOptions): WalkInput {
  let press: { x: number; y: number } | null = null;
  let rightPress: { x: number; y: number } | null = null;
  let mode: BuildMode = NOT_BUILDING;
  /** Where the pointer last was over the canvas, or null if it has left. */
  let hover: { x: number; y: number } | null = null;
  /** The animation frame that will update the cursor, if one is waiting. */
  let cursorFrame: number | null = null;

  /** What a left-click acts on: what is under the pointer, looking through finished structures. */
  function pickThrough(clientX: number, clientY: number): GroundOrThingPick | undefined {
    const pick = pickAt(clientX, clientY);
    return pick?.kind === "structure" ? pick.under : pick;
  }

  function updateCursor(): void {
    cursorFrame = null;
    const seen = hover === null ? undefined : pickAt(hover.x, hover.y);
    // A left-click acts on what is under a finished structure, so the cursor and outline do too.
    const pick = seen?.kind === "structure" ? seen.under : seen;
    const placing = mode.placing !== null;
    const blueprint = placingBlueprintFor(pick);
    canvas.style.cursor = blueprint?.allowed === false ? "not-allowed" : cursorFor(pick, placing);
    onHoverChange?.(outlineFor(pick, placing));
    onPromptTargetChange?.(placing ? undefined : seen);
    onPlacingBlueprintChange?.(blueprint);
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

  function onPointerMove(event: PointerEvent): void {
    hover = { x: event.clientX, y: event.clientY };
    queueCursorUpdate();
  }

  function onPointerLeave(): void {
    hover = null;
    queueCursorUpdate();
  }

  function setMode(value: BuildMode): void {
    mode = value;
    queueCursorUpdate();
    onBuildModeChange?.(value);
  }

  function onPointerDown(event: PointerEvent): void {
    // Any press on the scene closes an open menu.
    onMenuChange?.(undefined);
    if (event.button === RIGHT_BUTTON) {
      rightPress = { x: event.clientX, y: event.clientY };
      return;
    }
    if (event.button !== LEFT_BUTTON) return;
    press = { x: event.clientX, y: event.clientY };
  }

  /** Opens the menu for what a right-click without a drag landed on, if it offers anything. */
  function openMenu(event: PointerEvent): void {
    if (rightPress === null) return;
    const travelled = Math.hypot(event.clientX - rightPress.x, event.clientY - rightPress.y);
    rightPress = null;
    if (travelled > CLICK_MAX_TRAVEL_PIXELS || mode.placing !== null) return;
    const pick = pickAt(event.clientX, event.clientY);
    if (pick !== undefined) showMenu(event.clientX, event.clientY, pick);
  }

  /** Opens the menu of every action the thing offers at a point on the page, if it offers any a left-click does not do. */
  function showMenu(x: number, y: number, pick: ScenePick): void {
    const actions = menuFor(pick, client);
    if (actions !== undefined) onMenuChange?.({ x, y, actions });
  }

  function onPointerUp(event: PointerEvent): void {
    if (event.button === RIGHT_BUTTON) {
      openMenu(event);
      return;
    }
    if (event.button !== LEFT_BUTTON) return;
    if (press === null) return;
    const travelled = Math.hypot(event.clientX - press.x, event.clientY - press.y);
    press = null;
    if (travelled > CLICK_MAX_TRAVEL_PIXELS) return;
    const pick = pickThrough(event.clientX, event.clientY);
    if (pick === undefined) return;
    if (mode.placing !== null) {
      // A click where the blueprint is not allowed does nothing, so the player can try another spot.
      if (placingBlueprintFor(pick)?.allowed !== true) return;
      const place = placeCommandFor(mode, pick);
      if (place === undefined) return;
      client.send(place);
      setMode(NOT_BUILDING);
      return;
    }
    const action = leftClickFor(pick, client);
    if (action?.command !== undefined) client.send(action.command);
    // A work station's main action opens its menu, which lists the recipes made there.
    else if (action?.id === "openMenu") showMenu(event.clientX, event.clientY, pick);
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
    const next = event.code === "Escape" || !typing ? pressBuildKey(mode, event.code) : undefined;
    if (next !== undefined) {
      setMode(next);
      return;
    }
    if (event.code === "KeyE" && !typing && mode.placing === null) {
      const use = useKeyFor(client);
      if (use?.action.command !== undefined) client.send(use.action.command);
      else if (use?.action.id === "openMenu") {
        // E has no cursor spot to open the menu at, so it opens in the middle of the scene, where the player stands.
        const bounds = canvas.getBoundingClientRect();
        showMenu(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2, use.thing);
      }
      return;
    }
    if (event.code !== "Space" || target?.closest("input, textarea, select, button") != null) return;
    event.preventDefault();
    rig.snapToFollowTarget();
  }

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
    dispose() {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      if (cursorFrame !== null) cancelAnimationFrame(cursorFrame);
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
