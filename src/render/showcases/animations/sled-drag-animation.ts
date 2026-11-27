// The showcase of the "sled-drag-animation". The "sled-rope" showcase reuses it with closer framing.
import { DRAG_ROPE_METRES } from "../../../sim/sleds";
import { STRIDE_METRES } from "../../player-timing";
import { SLED_HEAVE_PEAK_SHARE } from "../../player-sled-drag-pose";
import type { Showcase, Stage } from "../types";
import { DRAG_WALK_METRES_PER_SECOND } from "./shared";

/** How long the player walks, then stands, in each loop of the "sled-drag-animation" showcase, in seconds. */
const DRAG_PLAY_WALK_SECONDS = 4;
const DRAG_PLAY_REST_SECONDS = 1.5;

/** Moves the player `walked` metres along +x, facing that way, with the sled they drag the rope's length behind. */
function dragTo({ store, movePlayer }: Stage, walked: number): void {
  movePlayer(walked, 0, Math.PI / 2);
  const sled = store.with("sled", "position").first;
  if (sled !== undefined) Object.assign(sled.position, { x: walked - DRAG_ROPE_METRES });
}

/**
 * The "sled-drag-animation" and the "sled-rope": the player drags a loaded sled along +x by a rope over the left shoulder.
 * The stills show the stride from the rope hand's side, the loaded sled, the lean while standing, and the rope from behind.
 */
export const SLED_DRAG_SHOWCASE: Showcase = {
  radius: 1.9,
  focus: { x: -0.8, y: 0.7, z: 0 },
  shots: [
    { label: "push-off heave, rope hand side", yaw: 180, pitch: 5, share: SLED_HEAVE_PEAK_SHARE / 2, radius: 1.2, focus: { x: -0.2, y: 0.7 } },
    { label: "walking with the loaded sled, right foot lands", yaw: 40, pitch: 15, share: 0.5 },
    { label: "standing, leaning into the rope", yaw: 230, pitch: 15, radius: 1.2, focus: { x: -0.2, y: 0.7 } },
    { label: "carrying a log while dragging", yaw: 150, pitch: 15, share: 0.25, radius: 1.6, focus: { x: -0.4, y: 0.8 } },
  ].map(({ share, ...shot }) => (share === undefined ? shot : { ...shot, seconds: (share * STRIDE_METRES) / DRAG_WALK_METRES_PER_SECOND })),
  build(stage) {
    const sled = stage.place(-DRAG_ROPE_METRES, 0, { sled: { log: 4, debarkedLog: 2, plank: 0 }, facing: { turns: 0 }, dragHeading: 0 });
    const player = stage.store.with("player").first;
    const sledId = stage.store.id(sled);
    if (player !== undefined && sledId !== undefined) stage.store.addComponent(player, "dragging", { sledId });
    dragTo(stage, 0);
    stage.player.setMotion("sled-drag-animation", true);
  },
  pose({ player }, shot) {
    player.setWalking(shot.seconds === undefined ? undefined : shot.seconds * DRAG_WALK_METRES_PER_SECOND);
    player.setCarryingLog(shot.label.startsWith("carrying") ? "log" : undefined);
  },
  // The player drags the sled forward at dragging speed, then stands leaning into the rope, then walks on. The camera keeps pace.
  play: {
    shot: { label: "dragging, then standing", yaw: 30, pitch: 15, radius: 2.4 },
    pose(stage, seconds) {
      const loop = DRAG_PLAY_WALK_SECONDS + DRAG_PLAY_REST_SECONDS;
      const walking = seconds % loop < DRAG_PLAY_WALK_SECONDS;
      const walkedSeconds = Math.floor(seconds / loop) * DRAG_PLAY_WALK_SECONDS + Math.min(seconds % loop, DRAG_PLAY_WALK_SECONDS);
      const walked = (walkedSeconds * DRAG_WALK_METRES_PER_SECOND) % 60;
      dragTo(stage, walked);
      stage.player.setWalking(walking ? walked : undefined);
      return { x: walked };
    },
  },
};
