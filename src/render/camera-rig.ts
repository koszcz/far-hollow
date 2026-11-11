import type { Vec3 } from "../sim/entities";

const MIN_PITCH = (20 * Math.PI) / 180;
const MAX_PITCH = (75 * Math.PI) / 180;
const START_PITCH = (45 * Math.PI) / 180;
const MIN_DISTANCE_METRES = 8;
const MAX_DISTANCE_METRES = 1300;
/** Close enough to see the player and the trees around them. */
const START_DISTANCE_METRES = 40;
/** The camera starts south-east of the point it looks at. */
const START_YAW = Math.PI / 4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface CameraView {
  /** Where the camera is. */
  readonly eye: Vec3;
  /** The point the camera looks at. */
  readonly focus: Vec3;
}

/**
 * Where the camera is and where it looks. Rendering only: it never changes game state.
 * The camera orbits a focus point on the ground. Rotation turns it around that point.
 */
export interface CameraRig {
  /** How steeply the camera looks down, in radians above the ground. */
  readonly pitch: number;
  /** Tilts the camera. Positive values look more steeply down. */
  tilt(radians: number): void;
  /** How far the camera is from the point it looks at, in metres. */
  readonly distance: number;
  /** Multiplies the distance. Values below 1 zoom in. */
  zoomBy(factor: number): void;
  /** Turns the camera around the point it looks at. */
  rotate(radians: number): void;
  /**
   * Moves the point the camera looks at, in metres, relative to the way the camera faces.
   * Used for right-drag. While following, it moves the view away from the target until snapped back.
   */
  pan(rightMetres: number, forwardMetres: number): void;
  /** Pans like `pan`, but only when follow is off. Used for WASD and the screen edges. */
  panWhenFree(rightMetres: number, forwardMetres: number): void;
  view(): CameraView;
  /** Whether the camera keeps the follow target in view. On by default. */
  readonly followEnabled: boolean;
  /** Turns follow on or off. Turning it off leaves the camera looking where it was. */
  setFollowEnabled(enabled: boolean): void;
  /**
   * Looks straight at the follow target again. While following, this removes any right-drag offset.
   * With follow off, it moves the view to where the target is now, and the view stays there.
   */
  snapToFollowTarget(): void;
  /**
   * Sets what the camera follows, such as the player's drawn position, or null for nothing.
   * The rig reads the object each time it builds a view, so the caller can keep moving it.
   */
  setFollowTarget(target: Readonly<Vec3> | null): void;
}

export interface CameraRigOptions {
  /** Height of the ground at a point. The camera looks at the ground when it follows nothing. Flat by default. */
  readonly groundHeightAt?: (x: number, z: number) => number;
}

export function createCameraRig({ groundHeightAt = () => 0 }: CameraRigOptions = {}): CameraRig {
  let pitch = START_PITCH;
  let distance = START_DISTANCE_METRES;
  let yaw = START_YAW;
  /** The point the camera looks at when it is not following anything. */
  let freeFocus = { x: 0, y: 0, z: 0 };
  let followEnabled = true;
  let followTarget: Readonly<Vec3> | null = null;
  /** How far a right-drag has moved the view away from the follow target. */
  const followOffset = { x: 0, z: 0 };

  function isFollowing(): boolean {
    return followEnabled && followTarget !== null;
  }

  function currentFocus(): Vec3 {
    if (followEnabled && followTarget !== null) {
      return { x: followTarget.x + followOffset.x, y: followTarget.y, z: followTarget.z + followOffset.z };
    }
    return { x: freeFocus.x, y: groundHeightAt(freeFocus.x, freeFocus.z), z: freeFocus.z };
  }

  function resetFollowOffset(): void {
    followOffset.x = 0;
    followOffset.z = 0;
  }

  function pan(rightMetres: number, forwardMetres: number): void {
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const moved = isFollowing() ? followOffset : freeFocus;
    moved.x += rightMetres * cos - forwardMetres * sin;
    moved.z += -rightMetres * sin - forwardMetres * cos;
  }

  return {
    get pitch() {
      return pitch;
    },
    tilt(radians) {
      pitch = clamp(pitch + radians, MIN_PITCH, MAX_PITCH);
    },
    get distance() {
      return distance;
    },
    zoomBy(factor) {
      distance = clamp(distance * factor, MIN_DISTANCE_METRES, MAX_DISTANCE_METRES);
    },
    rotate(radians) {
      yaw += radians;
    },
    pan,
    panWhenFree(rightMetres, forwardMetres) {
      if (!followEnabled) pan(rightMetres, forwardMetres);
    },
    view() {
      const focus = currentFocus();
      const groundDistance = distance * Math.cos(pitch);
      return {
        eye: {
          x: focus.x + groundDistance * Math.sin(yaw),
          y: focus.y + distance * Math.sin(pitch),
          z: focus.z + groundDistance * Math.cos(yaw),
        },
        focus,
      };
    },
    get followEnabled() {
      return followEnabled;
    },
    setFollowEnabled(enabled) {
      if (enabled === followEnabled) return;
      if (!enabled) freeFocus = currentFocus();
      followEnabled = enabled;
      resetFollowOffset();
    },
    setFollowTarget(target) {
      followTarget = target;
    },
    snapToFollowTarget() {
      resetFollowOffset();
      if (!followEnabled && followTarget !== null) freeFocus = { ...followTarget };
    },
  };
}
