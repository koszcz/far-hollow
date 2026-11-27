import type * as THREE from "three";
import { blendLeftAt, REACH_BLEND_IN_SECONDS, REACH_BLEND_OUT_SECONDS } from "./player-reach-pose";

export interface ReachBlend {
  /** Starts a blend from the pose shown now. Pass `endedAt`, in performance seconds, when the reach has ended. */
  start(endedAt?: number): void;
  /**
   * Fades the pose a reach started from, or ended in, into the pose now, so the player never jumps between frames.
   * `reachSeconds` is how far into the reach the player is, while reaching. Calls `remember` on every bone it moves.
   */
  apply(reachSeconds: number, remember: (...bones: THREE.Object3D[]) => void): void;
}

/** Blends whole poses of `skeletonBones`, so a reach starts and ends smoothly. */
export function createReachBlend(skeletonBones: readonly THREE.Object3D[]): ReachBlend {
  /**
   * The pose the player held when a reach started, started again, or ended, which fades into the pose now.
   * While reaching, the blend runs on the reach's own clock. Afterwards, it runs on the performance clock from `endedAt`.
   */
  let blend: { from: Map<THREE.Object3D, { position: THREE.Vector3; quaternion: THREE.Quaternion }>; endedAt?: number } | undefined;
  return {
    start(endedAt) {
      const from = new Map<THREE.Object3D, { position: THREE.Vector3; quaternion: THREE.Quaternion }>();
      for (const posed of skeletonBones) from.set(posed, { position: posed.position.clone(), quaternion: posed.quaternion.clone() });
      blend = endedAt === undefined ? { from } : { from, endedAt };
    },
    apply(reachSeconds, remember) {
      if (blend === undefined) return;
      const left =
        blend.endedAt === undefined
          ? blendLeftAt(reachSeconds, REACH_BLEND_IN_SECONDS)
          : blendLeftAt(performance.now() / 1000 - blend.endedAt, REACH_BLEND_OUT_SECONDS);
      if (left <= 0) {
        blend = undefined;
        return;
      }
      remember(...skeletonBones);
      for (const [posed, was] of blend.from) {
        posed.position.lerp(was.position, left);
        posed.quaternion.slerp(was.quaternion, left);
      }
    },
  };
}
