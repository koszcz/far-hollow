import type { CameraRig } from "../render/camera-rig";
import type { GroundOrThingPick, PlacementPreview, ScenePick } from "../render/scene-renderer";
import type { BlueprintView, CarriedLog, Command, GameClient, StructureKind } from "../sim/api";
import { NOT_BUILDING, pickBuildEntry, placeCommandFor, pressBuildKey, type BuildMode } from "./build-mode";
import { strings } from "../strings";

/**
 * The command a left-click sends for what it landed on. A blueprint is built only while the button is held, so it has none.
 * A click on a finished building piece acts on what is under it.
 */
export function mainActionFor(pick: ScenePick): Command | undefined {
  switch (pick.kind) {
    case "structure":
      return pick.under === undefined ? undefined : mainActionFor(pick.under);
    case "ground":
      return { type: "walkTo", x: pick.spot.x, z: pick.spot.z };
    case "river":
      return { type: "drinkFromRiver", x: pick.spot.x, z: pick.spot.z };
    case "tree":
      return { type: "chopTree", treeId: pick.id };
    case "log":
    case "debarkedLog":
      return { type: "pickUpLog", logId: pick.id };
    case "stick":
      return { type: "pickUpStick", stickId: pick.id };
    case "forage":
      return { type: "forage", spotId: pick.id };
    case "campfire":
      return { type: "tendCampfire", campfireId: pick.id };
    case "woodpile":
      return { type: "tendWoodpile", woodpileId: pick.id };
    case "bedroll":
      return { type: "sleep", bedrollId: pick.id };
    case "pile":
      return { type: "pickUpPile", pileId: pick.id };
    case "blueprint":
      return undefined;
  }
}

/**
 * The command a press on a blueprint sends. If the player carries a material the blueprint still needs, such as a debarked log,
 * the press adds it. Otherwise it builds the blueprint for as long as the button is held.
 */
export function blueprintPressFor(blueprint: BlueprintView, carrying: CarriedLog | null): Command {
  const needsCarried = blueprint.deliveries.some(({ material, has, needs }) => material === carrying && has < needs);
  return needsCarried ? { type: "deliverToBlueprint", blueprintId: blueprint.id } : { type: "build", blueprintId: blueprint.id };
}

/** One choice in the menu a right-click opens: its text, and the command it sends. */
export interface MenuAction {
  readonly label: string;
  readonly command: Command;
}

/** The choices a right-click on this thing offers, beyond what a left-click does. Empty if it offers none. */
export function menuActionsFor(pick: ScenePick): MenuAction[] {
  switch (pick.kind) {
    case "log":
      return [{ label: strings.debark, command: { type: "debarkLog", logId: pick.id } }];
    case "blueprint":
    case "structure":
      return [{ label: strings.takeDown, command: { type: "takeDown", pieceId: pick.id } }];
    default:
      return [];
  }
}

/** A right-click menu to show at a point on the page, in page pixels. */
export interface MenuRequest {
  readonly x: number;
  readonly y: number;
  readonly actions: readonly MenuAction[];
}

/**
 * The CSS cursor to show for what is under the pointer.
 * A hand marks things the player can click. While placing a blueprint, a crosshair shows everywhere.
 * A finished building piece shows the cursor for what is under it, since a left-click acts on that.
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
  /** Called when the build menu opens or closes, or placing a blueprint starts, turns, or ends, so the HUD can show it. */
  readonly onBuildModeChange?: (mode: BuildMode) => void;
  /** Called with the blueprint that should follow the mouse while placing, or undefined to hide it. */
  readonly onPreviewChange?: (preview: PlacementPreview | undefined) => void;
  /** Called with the menu a right-click opens, or undefined when it should close. */
  readonly onMenuChange?: (menu: MenuRequest | undefined) => void;
}

export interface WalkInput {
  /** Opens the build menu, or closes it if it is open. B does the same. */
  toggleBuildMenu(): void;
  /** Puts a structure's blueprint under the mouse. A left-click on the ground places it. R turns it. Escape cancels. */
  pickBuildEntry(structure: StructureKind): void;
  /** True while the left button is held on a blueprint to build it. */
  isHoldingBuild(): boolean;
  /** Removes the listeners. */
  dispose(): void;
}

/**
 * Left-clicking does the main action for what is under the pointer:
 * walk to a spot on the ground, chop a tree, pick up a log, pick up a stick, forage a bush or mushrooms,
 * walk over to tend a campfire or use a woodpile, walk to the riverbank to drink, or walk to a bedroll and sleep on it.
 * Holding the left button on a blueprint builds it. Letting go stops building. Clicking a blueprint while carrying a debarked log it needs adds the log.
 * B opens and closes the build menu. While placing a blueprint picked from it, the blueprint follows the mouse,
 * R turns it, a left-click on the ground places it, and Escape cancels.
 * A left-drag pans the camera instead, so it never counts as a click.
 * A right-click without a drag opens a menu of the other actions the thing allows, such as debarking a log or taking down a building piece.
 * Only the right-click menu sees finished building pieces. Other clicks act on what is under them.
 * A right-drag turns the camera instead.
 * Space snaps the camera back to the player.
 */
export function attachWalkInput({ canvas, client, rig, pickAt, onHoverChange, onBuildModeChange, onPreviewChange, onMenuChange }: WalkInputOptions): WalkInput {
  let press: { x: number; y: number } | null = null;
  let rightPress: { x: number; y: number } | null = null;
  let holdingBuild = false;
  let mode: BuildMode = NOT_BUILDING;
  /** Where the pointer last was over the canvas, or null if it has left. */
  let hover: { x: number; y: number } | null = null;
  /** The animation frame that will update the cursor, if one is waiting. */
  let cursorFrame: number | null = null;

  /** What a left-click acts on: what is under the pointer, looking through finished building pieces. */
  function pickThrough(clientX: number, clientY: number): GroundOrThingPick | undefined {
    const pick = pickAt(clientX, clientY);
    return pick?.kind === "structure" ? pick.under : pick;
  }

  function updateCursor(): void {
    cursorFrame = null;
    const pick = hover === null ? undefined : pickThrough(hover.x, hover.y);
    const placing = mode.placing !== null;
    const preview = previewFor(pick);
    canvas.style.cursor = preview?.allowed === false ? "not-allowed" : cursorFor(pick, placing);
    onHoverChange?.(outlineFor(pick, placing));
    onPreviewChange?.(preview);
  }

  /** The blueprint to show under the mouse while placing, snapped to the building grid. */
  function previewFor(pick: ScenePick | undefined): PlacementPreview | undefined {
    if (mode.placing === null || pick?.kind !== "ground") return undefined;
    const { structure, turns } = mode.placing;
    return { structure, turns, ...client.checkPlacement(structure, pick.spot, turns) };
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

  function stopHoldingBuild(): void {
    if (!holdingBuild) return;
    holdingBuild = false;
    client.send({ type: "stopBuilding" });
  }

  function onPointerDown(event: PointerEvent): void {
    // Any press on the scene closes an open menu.
    onMenuChange?.(undefined);
    if (event.button === RIGHT_BUTTON) {
      rightPress = { x: event.clientX, y: event.clientY };
      return;
    }
    if (event.button !== LEFT_BUTTON) return;
    if (mode.placing === null) {
      const pick = pickThrough(event.clientX, event.clientY);
      const blueprint = pick?.kind === "blueprint" ? client.describeBlueprint(pick.id) : null;
      if (blueprint !== null) {
        const command = blueprintPressFor(blueprint, client.getView().carrying);
        // Adding a material is one click. Only building goes on while the button is held.
        holdingBuild = command.type === "build";
        client.send(command);
        return;
      }
    }
    press = { x: event.clientX, y: event.clientY };
  }

  /** Opens the menu for what a right-click without a drag landed on, if it offers anything. */
  function openMenu(event: PointerEvent): void {
    if (rightPress === null) return;
    const travelled = Math.hypot(event.clientX - rightPress.x, event.clientY - rightPress.y);
    rightPress = null;
    if (travelled > CLICK_MAX_TRAVEL_PIXELS || mode.placing !== null) return;
    const pick = pickAt(event.clientX, event.clientY);
    const actions = pick === undefined ? [] : menuActionsFor(pick);
    if (actions.length > 0) onMenuChange?.({ x: event.clientX, y: event.clientY, actions });
  }

  function onPointerUp(event: PointerEvent): void {
    if (event.button === RIGHT_BUTTON) {
      openMenu(event);
      return;
    }
    if (event.button !== LEFT_BUTTON) return;
    if (holdingBuild) {
      stopHoldingBuild();
      return;
    }
    if (press === null) return;
    const travelled = Math.hypot(event.clientX - press.x, event.clientY - press.y);
    press = null;
    if (travelled > CLICK_MAX_TRAVEL_PIXELS) return;
    const pick = pickThrough(event.clientX, event.clientY);
    if (pick === undefined) return;
    if (mode.placing !== null) {
      // A click where the blueprint is not allowed does nothing, so the player can try another spot.
      if (previewFor(pick)?.allowed !== true) return;
      const place = placeCommandFor(mode, pick);
      if (place === undefined) return;
      client.send(place);
      setMode(NOT_BUILDING);
      return;
    }
    const command = mainActionFor(pick);
    if (command !== undefined) client.send(command);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.code === "Escape") onMenuChange?.(undefined);
    if (event.repeat) return;
    // Let typing keep working in form fields, and Space keep pressing buttons.
    const target = event.target instanceof HTMLElement ? event.target : null;
    const typing = target?.closest("input, textarea, select") != null;
    const next = event.code === "Escape" || !typing ? pressBuildKey(mode, event.code) : undefined;
    if (next !== undefined) {
      setMode(next);
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
  // Letting go outside the canvas, or leaving the window, also lets go of the build action.
  canvas.addEventListener("pointercancel", stopHoldingBuild);
  window.addEventListener("pointerup", stopHoldingBuild);
  window.addEventListener("blur", stopHoldingBuild);
  window.addEventListener("keydown", onKeyDown);
  return {
    toggleBuildMenu() {
      setMode(pressBuildKey(mode, "KeyB") ?? mode);
    },
    pickBuildEntry(structure) {
      setMode(pickBuildEntry(structure));
    },
    isHoldingBuild() {
      return holdingBuild;
    },
    dispose() {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      if (cursorFrame !== null) cancelAnimationFrame(cursorFrame);
      canvas.removeEventListener("pointercancel", stopHoldingBuild);
      window.removeEventListener("pointerup", stopHoldingBuild);
      window.removeEventListener("blur", stopHoldingBuild);
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
