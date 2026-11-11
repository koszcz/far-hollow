import type { CameraRig } from "../render/camera-rig";
import type { ScenePick } from "../render/scene-renderer";
import type { Command, GameClient } from "../sim/api";

/** The command a left-click sends for what it landed on. A blueprint is built only while the button is held, so it has none. */
export function mainActionFor(pick: ScenePick): Command | undefined {
  switch (pick.kind) {
    case "ground":
      return { type: "walkTo", x: pick.spot.x, z: pick.spot.z };
    case "river":
      return { type: "drinkFromRiver", x: pick.spot.x, z: pick.spot.z };
    case "tree":
      return { type: "chopTree", treeId: pick.id };
    case "log":
      return { type: "pickUpLog", logId: pick.id };
    case "stick":
      return { type: "pickUpStick", stickId: pick.id };
    case "forage":
      return { type: "forage", spotId: pick.id };
    case "campfire":
      return { type: "tendCampfire", campfireId: pick.id };
    case "blueprint":
      return undefined;
  }
}

/**
 * The CSS cursor to show for what is under the pointer.
 * A hand marks things the player can click. While placing a campfire, a crosshair shows everywhere.
 */
export function cursorFor(pick: ScenePick | undefined, placing: boolean): string {
  if (placing) return "crosshair";
  if (pick === undefined || pick.kind === "ground") return "";
  return "pointer";
}

/**
 * What to outline for what is under the pointer: the same things that show a hand cursor, except the river.
 * The river is too big to outline. Nothing is outlined over the ground, or while placing a campfire.
 */
export function outlineFor(pick: ScenePick | undefined, placing: boolean): ScenePick | undefined {
  if (pick?.kind === "river") return undefined;
  return cursorFor(pick, placing) === "pointer" ? pick : undefined;
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
  /** Called when placing a campfire starts or ends, so the HUD can show it. */
  readonly onPlacingChange?: (placing: boolean) => void;
}

export interface WalkInput {
  /** Makes the next left-click on the ground place a campfire blueprint there. Escape cancels. */
  startPlacingCampfire(): void;
  /** Removes the listeners. */
  dispose(): void;
}

/**
 * Left-clicking does the main action for what is under the pointer:
 * walk to a spot on the ground, chop a tree, pick up a log, pick up a stick, forage a bush or mushrooms,
 * walk over to tend a campfire, or walk to the riverbank to drink.
 * Holding the left button on a blueprint builds it. Letting go stops building.
 * While placing a campfire, a left-click on the ground places its blueprint.
 * Space snaps the camera back to the player.
 */
export function attachWalkInput({ canvas, client, rig, pickAt, onHoverChange, onPlacingChange }: WalkInputOptions): WalkInput {
  let press: { x: number; y: number } | null = null;
  let holdingBuild = false;
  let placing = false;
  /** Where the pointer last was over the canvas, or null if it has left. */
  let hover: { x: number; y: number } | null = null;
  /** The animation frame that will update the cursor, if one is waiting. */
  let cursorFrame: number | null = null;

  function updateCursor(): void {
    cursorFrame = null;
    const pick = hover === null ? undefined : pickAt(hover.x, hover.y);
    canvas.style.cursor = cursorFor(pick, placing);
    onHoverChange?.(outlineFor(pick, placing));
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

  function setPlacing(value: boolean): void {
    if (placing === value) return;
    placing = value;
    queueCursorUpdate();
    onPlacingChange?.(value);
  }

  function stopHoldingBuild(): void {
    if (!holdingBuild) return;
    holdingBuild = false;
    client.send({ type: "stopBuilding" });
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.button !== LEFT_BUTTON) return;
    if (!placing) {
      const pick = pickAt(event.clientX, event.clientY);
      if (pick?.kind === "blueprint") {
        holdingBuild = true;
        client.send({ type: "build", blueprintId: pick.id });
        return;
      }
    }
    press = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: PointerEvent): void {
    if (event.button !== LEFT_BUTTON) return;
    if (holdingBuild) {
      stopHoldingBuild();
      return;
    }
    if (press === null) return;
    const travelled = Math.hypot(event.clientX - press.x, event.clientY - press.y);
    press = null;
    if (travelled > CLICK_MAX_TRAVEL_PIXELS) return;
    const pick = pickAt(event.clientX, event.clientY);
    if (pick === undefined) return;
    if (placing) {
      if (pick.kind !== "ground") return;
      client.send({ type: "placeCampfire", x: pick.spot.x, z: pick.spot.z });
      setPlacing(false);
      return;
    }
    const command = mainActionFor(pick);
    if (command !== undefined) client.send(command);
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.code === "Escape") {
      setPlacing(false);
      return;
    }
    if (event.code !== "Space" || event.repeat) return;
    // Let Space keep working in form fields and on buttons.
    if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, button") !== null) return;
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
    startPlacingCampfire() {
      setPlacing(true);
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
