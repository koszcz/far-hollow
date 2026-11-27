import type * as THREE from "three";

export interface ClipPoseMemory {
  /** Notes each bone's pose as the clip last set it, once, before code turns or moves the bone. */
  remember(...bones: THREE.Object3D[]): void;
  /** Puts every remembered bone back as the clip posed it. */
  restore(): void;
}

/** Each bone turned or moved by code, as the clip last posed it. The mixer does not put these back itself. */
export function createClipPoseMemory(): ClipPoseMemory {
  const posedByCode = new Map<THREE.Object3D, { position: THREE.Vector3; quaternion: THREE.Quaternion }>();
  return {
    remember(...bones) {
      for (const posed of bones) {
        if (!posedByCode.has(posed)) posedByCode.set(posed, { position: posed.position.clone(), quaternion: posed.quaternion.clone() });
      }
    },
    restore() {
      for (const [posed, clipPose] of posedByCode) {
        posed.position.copy(clipPose.position);
        posed.quaternion.copy(clipPose.quaternion);
      }
      posedByCode.clear();
    },
  };
}
