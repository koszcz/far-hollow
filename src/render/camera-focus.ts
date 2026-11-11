import type { Vec3 } from "../sim/entities";

/**
 * The spot on the ground the camera looks at.
 * By default it follows the player. Camera controls that move the view, such as panning, should move `point` and may turn `follow` off.
 */
export interface CameraFocus {
  readonly point: Vec3;
  /** The "camera follows the player" setting. On by default. */
  follow: boolean;
  /** Moves the focus back to the player on the next update, even when follow is off. */
  snapToPlayer(): void;
  /** Call once per frame with where the player is drawn. */
  update(player: Vec3): void;
}

export interface CameraFocusOptions {
  follow?: boolean;
  /** Where the focus starts, before the first update. */
  start?: Vec3;
}

export function createCameraFocus({ follow = true, start = { x: 0, y: 0, z: 0 } }: CameraFocusOptions = {}): CameraFocus {
  const point = { ...start };
  let snapPending = false;
  return {
    point,
    follow,
    snapToPlayer() {
      snapPending = true;
    },
    update(player) {
      if (!this.follow && !snapPending) return;
      snapPending = false;
      Object.assign(point, player);
    },
  };
}
