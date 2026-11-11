import type { CameraRig } from "../render/camera-rig";
import type { GameClient } from "../sim/api";
import type { GroundPoint } from "../sim/valley";

const LEFT_BUTTON = 0;
/** A left-button press that moves further than this is a drag, not a click. */
const CLICK_MAX_TRAVEL_PIXELS = 4;

export interface WalkInputOptions {
  readonly canvas: HTMLCanvasElement;
  readonly client: GameClient;
  readonly rig: CameraRig;
  /** The spot on the ground under a point on the screen, if any. */
  readonly groundSpotAt: (clientX: number, clientY: number) => GroundPoint | undefined;
}

/**
 * Left-clicking the ground sends a walkTo command.
 * Space snaps the camera back to the player.
 * Returns a function that removes the listeners.
 */
export function attachWalkInput({ canvas, client, rig, groundSpotAt }: WalkInputOptions): () => void {
  let press: { x: number; y: number } | null = null;

  function onPointerDown(event: PointerEvent): void {
    if (event.button === LEFT_BUTTON) press = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: PointerEvent): void {
    if (event.button !== LEFT_BUTTON || press === null) return;
    const travelled = Math.hypot(event.clientX - press.x, event.clientY - press.y);
    press = null;
    if (travelled > CLICK_MAX_TRAVEL_PIXELS) return;
    const spot = groundSpotAt(event.clientX, event.clientY);
    if (spot !== undefined) client.send({ type: "walkTo", x: spot.x, z: spot.z });
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
