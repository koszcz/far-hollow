import type { CameraRig } from "./camera-rig";

/** The pointer pans the camera when it is this close to a screen edge. */
const EDGE_PAN_MARGIN_PIXELS = 12;
/** A press must move this far before it counts as a drag rather than a click. */
const DRAG_THRESHOLD_PIXELS = 4;
/** Right-drag turns the camera this much per pixel. */
const DRAG_ROTATE_RADIANS_PER_PIXEL = 0.006;
const DRAG_TILT_RADIANS_PER_PIXEL = 0.004;
/** WASD and the screen edges pan this many camera distances per second, so the speed suits the zoom. */
const KEY_PAN_DISTANCES_PER_SECOND = 0.8;
/** Each wheel pixel multiplies the camera distance by e^this. */
const WHEEL_ZOOM_PER_PIXEL = 0.0015;
/** A trackpad pinch sends smaller wheel values, so each one zooms more. */
const PINCH_ZOOM_PER_PIXEL = 0.01;
const WHEEL_PIXELS_PER_LINE = 16;
const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;

export interface PointerPosition {
  readonly x: number;
  readonly y: number;
}

export interface ScreenSize {
  readonly width: number;
  readonly height: number;
}

export interface PanDirection {
  /** -1 pans left, 1 pans right. */
  readonly right: number;
  /** -1 pans back, 1 pans forward. */
  readonly forward: number;
}

/** Which way the pointer at a screen edge pans the camera. Pass null when the pointer is off the screen. */
export function edgePanDirection(pointer: PointerPosition | null, screen: ScreenSize): PanDirection {
  if (pointer === null) return { right: 0, forward: 0 };
  let right = 0;
  if (pointer.x < EDGE_PAN_MARGIN_PIXELS) right = -1;
  else if (pointer.x >= screen.width - EDGE_PAN_MARGIN_PIXELS) right = 1;
  let forward = 0;
  if (pointer.y < EDGE_PAN_MARGIN_PIXELS) forward = 1;
  else if (pointer.y >= screen.height - EDGE_PAN_MARGIN_PIXELS) forward = -1;
  return { right, forward };
}

export interface CameraInput {
  /** Applies held keys and screen-edge panning. Call once per drawn frame. */
  update(elapsedSeconds: number): void;
  dispose(): void;
}

export interface CameraInputOptions {
  readonly canvas: HTMLCanvasElement;
  readonly rig: CameraRig;
  /** The camera's vertical field of view, so a left-drag moves the ground with the pointer. */
  readonly fieldOfViewDegrees: number;
}

/**
 * Turns mouse, trackpad, and keyboard input into camera moves.
 * Left-drag pans the camera. Right-drag turns and tilts it.
 * No key turns the camera. E is the use key, handled in walk-input.ts.
 * It only moves the camera. It never sends commands to the game.
 */
export function attachCameraInput({ canvas, rig, fieldOfViewDegrees }: CameraInputOptions): CameraInput {
  const heldKeys = new Set<string>();
  let pointer: PointerPosition | null = null;
  let press: { button: number; lastX: number; lastY: number; travelled: number; dragging: boolean } | null = null;
  const halfFieldOfViewTan = Math.tan((fieldOfViewDegrees * Math.PI) / 360);

  function groundMetresPerPixel(): number {
    return (2 * rig.distance * halfFieldOfViewTan) / Math.max(1, canvas.clientHeight);
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.button !== LEFT_BUTTON && event.button !== RIGHT_BUTTON) return;
    if (press !== null) return;
    press = { button: event.button, lastX: event.clientX, lastY: event.clientY, travelled: 0, dragging: false };
    canvas.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent): void {
    const bounds = canvas.getBoundingClientRect();
    pointer = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    if (press === null) return;
    const dx = event.clientX - press.lastX;
    const dy = event.clientY - press.lastY;
    press.lastX = event.clientX;
    press.lastY = event.clientY;
    press.travelled += Math.hypot(dx, dy);
    if (!press.dragging && press.travelled < DRAG_THRESHOLD_PIXELS) return;
    press.dragging = true;
    if (press.button === RIGHT_BUTTON) {
      rig.rotate(-dx * DRAG_ROTATE_RADIANS_PER_PIXEL);
      rig.tilt(dy * DRAG_TILT_RADIANS_PER_PIXEL);
    } else {
      // The ground follows the pointer, as if the player grabbed it.
      const metres = groundMetresPerPixel();
      rig.pan(-dx * metres, dy * metres);
    }
  }

  function onPointerUp(event: PointerEvent): void {
    if (press === null || event.button !== press.button) return;
    // A right-click without a drag opens the action menu. walk-input.ts handles that.
    press = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }

  function onPointerLeave(): void {
    pointer = null;
  }

  function onContextMenu(event: MouseEvent): void {
    event.preventDefault();
  }

  function onWheel(event: WheelEvent): void {
    event.preventDefault();
    const pixels = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * WHEEL_PIXELS_PER_LINE : event.deltaY;
    // Browsers report a trackpad pinch as a wheel event with the Control key held.
    const perPixel = event.ctrlKey ? PINCH_ZOOM_PER_PIXEL : WHEEL_ZOOM_PER_PIXEL;
    rig.zoomBy(Math.exp(pixels * perPixel));
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.metaKey || event.ctrlKey) return;
    heldKeys.add(event.code);
  }

  function onKeyUp(event: KeyboardEvent): void {
    heldKeys.delete(event.code);
  }

  function onBlur(): void {
    heldKeys.clear();
    pointer = null;
  }

  function keyAxis(negative: string, positive: string): number {
    return (heldKeys.has(positive) ? 1 : 0) - (heldKeys.has(negative) ? 1 : 0);
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("contextmenu", onContextMenu);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("pointermove", onPointerMove);
  document.documentElement.addEventListener("pointerleave", onPointerLeave);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  return {
    update(elapsedSeconds) {
      const edge = press === null ? edgePanDirection(pointer, { width: canvas.clientWidth, height: canvas.clientHeight }) : { right: 0, forward: 0 };
      const right = clampUnit(keyAxis("KeyA", "KeyD") + edge.right);
      const forward = clampUnit(keyAxis("KeyS", "KeyW") + edge.forward);
      if (right === 0 && forward === 0) return;
      const metres = rig.distance * KEY_PAN_DISTANCES_PER_SECOND * elapsedSeconds;
      rig.panWhenFree(right * metres, forward * metres);
    },
    dispose() {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("contextmenu", onContextMenu);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    },
  };
}

function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value));
}
