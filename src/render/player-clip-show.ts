import * as THREE from "three";

/** A clip held still at one moment, mixed with a second held clip if `blend.weight` is above 0. `weight` runs 0 (none of it) to 1 (all of it). */
export type ShowClip = (action: THREE.AnimationAction, seconds: number, blend?: { action: THREE.AnimationAction; seconds: number; weight: number }) => void;

/** Makes the function that shows `action` frozen `seconds` into its clip, with the `mixer` posing the model. */
export function createShowClip(mixer: THREE.AnimationMixer): ShowClip {
  let playing: THREE.AnimationAction[] = [];
  const freeze = (shown: THREE.AnimationAction, at: number, weight: number) => {
    const duration = shown.getClip().duration;
    shown.time = ((at % duration) + duration) % duration;
    shown.setEffectiveWeight(weight);
  };
  return (action, seconds, blend) => {
    const wanted = blend !== undefined && blend.weight > 0 ? [action, blend.action] : [action];
    for (const shown of playing) if (!wanted.includes(shown)) shown.stop();
    for (const shown of wanted) if (!playing.includes(shown)) shown.play();
    playing = wanted;
    const weight = blend !== undefined && blend.weight > 0 ? Math.min(1, blend.weight) : 0;
    freeze(action, seconds, 1 - weight);
    if (blend !== undefined && weight > 0) freeze(blend.action, blend.seconds, weight);
    mixer.update(0);
  };
}

/** A limb of the player: the bone that reaches out at its end, on one side. */
interface ReachingArm {
  readonly end: THREE.Object3D;
}

/**
 * The moment in `action` when a wrist scores best, and the arm that wrist belongs to: the arm that reaches.
 * `group` is the player, and the player faces +z.
 */
export function contactSeconds<Arm extends ReachingArm>(
  showClip: ShowClip,
  group: THREE.Group,
  arms: readonly [Arm, Arm],
  action: THREE.AnimationAction,
  score: (wrist: THREE.Vector3) => number,
): { seconds: number; arm: Arm } {
  const wrist = new THREE.Vector3();
  const duration = action.getClip().duration;
  let best = { seconds: duration / 2, arm: arms[1], score: -Infinity };
  for (let seconds = 0; seconds < duration; seconds += 1 / 60) {
    showClip(action, seconds);
    group.updateMatrixWorld(true);
    for (const arm of arms) {
      const scored = score(group.worldToLocal(arm.end.getWorldPosition(wrist)));
      if (scored > best.score) best = { seconds, arm, score: scored };
    }
  }
  return { seconds: best.seconds, arm: best.arm };
}
