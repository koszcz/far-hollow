import type { CameraRig } from "../render/camera-rig";
import type { ScenePick } from "../render/scene-renderer";
import type { Command, GameClient } from "../sim/api";

/** The command a left-click sends for what it landed on. */
export function mainActionFor(pick: ScenePick): Command {
  switch (pick.kind) {
    case "ground":
      return { type: "walkTo", x: pick.spot.x, z: pick.spot.z };
    case "tree":
      return { type: "chopTree", treeId: pick.id };
    case "log":
      return { type: "pickUpLog", logId: pick.id };
  }
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
}

/**
 * Left-clicking does the main action for what is under the pointer:
 * walk to a spot on the ground, chop a tree, or pick up a log.
 * Space snaps the camera back to the player.
 * Returns a function that removes the listeners.
 */
export function attachWalkInput({ canvas, client, rig, pickAt }: WalkInputOptions): () => void {
  let press: { x: number; y: number } | null = null;

  function onPointerDown(event: PointerEvent): void {
    if (event.button === LEFT_BUTTON) press = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: PointerEvent): void {
    if (event.button !== LEFT_BUTTON || press === null) return;
    const travelled = Math.hypot(event.clientX - press.x, event.clientY - press.y);
    press = null;
    if (travelled > CLICK_MAX_TRAVEL_PIXELS) return;
    const pick = pickAt(event.clientX, event.clientY);
    if (pick === undefined) return;
    client.send(mainActionFor(pick));
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.code !== "Space" || event.repeat) return;
    // Let Space keep working in form fields and on buttons.
    if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, button") !== null) return;
    event.preventDefault();
    rig.snapToFollowTarget();
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  window.addEventListener("keydown", onKeyDown);
  return () => {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("keydown", onKeyDown);
  };
}
