// What a player motion is, and what the player mesh lends it. A player motion is one animation asset that poses the
// player in code, such as fishing or crafting by hand, with its props. Each lives in its own module in this folder,
// and motion-list.ts names them all. See docs/adr/0012-each-player-motion-is-its-own-module.md.
import type * as THREE from "three";
import type { LogShape } from "../log-shape";
import type { BuildBones, BuildPose, Limb } from "../player-build-pose";
import { createWorkMotion, type WorkChange } from "../work-motion";

/** What the player mesh lends each motion. */
export interface PlayerRig {
  /** The player's group. The player faces +z in it, and their right is -x. */
  readonly group: THREE.Group;
  /** The bones used for posing. */
  readonly bones: BuildBones;
  readonly leftArm: Limb;
  readonly rightArm: Limb;
  /** The loaded log, for measuring. The forest owns it. */
  readonly logShape: LogShape;
  /** Makes a material that the player mesh disposes of. */
  material(color: THREE.ColorRepresentation, extra?: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial;
  /** Poses the body on top of the clip, moving only `arms`. The player mesh puts the clip pose back before the next pose. */
  applyPose(pose: BuildPose, arms: readonly Limb[]): void;
  /** Whether the player carries a log on the shoulder, steadied by the right hand. */
  readonly carrying: boolean;
  /** The total metres walked so far, or undefined while standing still. */
  readonly walkedMetres: number | undefined;
  /** Whether the body is busy now: walking, chopping, splitting, or playing a body motion. */
  readonly bodyMoves: boolean;
}

/**
 * Which part of the player a motion poses. A `body` motion poses the whole body, and the first one playing in the motion
 * list wins. An `upperBody` motion poses the arms and head over whatever body motion plays. An `overlay` has no pose.
 * It only places its props.
 */
export type MotionLayer = "body" | "upperBody" | "overlay";

/**
 * What one update did. A work motion starts, which ends standing back up, or stops, with how the player stands back up.
 * A motion that never stands the player up only shows or hides.
 */
export type MotionChange = WorkChange | { readonly kind: "shown" } | { readonly kind: "hidden" };

export interface PlayerMotion<Moment> {
  readonly layer: MotionLayer;
  /** Whether the axe goes on the back while the motion plays. */
  readonly axeOnBack: boolean;
  /** Whether the motion plays now. */
  readonly playing: boolean;
  /** Moves the motion on to `moment`, or stops it when `moment` is undefined. `now` is the performance clock, in seconds. */
  update(moment: Moment | undefined, now: number): MotionChange;
  /** Poses the player for the motion, while it plays. An overlay has none. */
  readonly pose?: () => void;
  /** Shows or hides the motion's props, from the pose. It runs after every pose is applied. */
  placeProps(): void;
  dispose(): void;
}

/** The arms free to move: both, or only the left while the right hand steadies a log on the shoulder. */
export function freeArms(rig: PlayerRig): readonly Limb[] {
  return rig.carrying ? [rig.leftArm] : rig.bones.arms;
}

/** A body motion built on a work motion, with the parts every such motion shares. */
export interface BodyWorkMotion<Moment> {
  readonly since: number | undefined;
  readonly at: Moment | undefined;
  readonly playing: boolean;
  readonly update: (moment: Moment | undefined, now: number) => MotionChange;
  /** Poses the whole body, moving the free arms. */
  readonly pose: () => void;
}

/**
 * A body motion that starts, keeps its start time, and stands back up as createWorkMotion does. Each moment is copied,
 * so a caller may change its own object afterwards.
 */
export function createBodyWorkMotion<Moment>(
  rig: PlayerRig,
  options: { startOf: (at: Moment) => number; poseAt: (at: Moment, since: number) => BuildPose; leaveSeconds?: number },
): BodyWorkMotion<Moment> {
  const work = createWorkMotion<Moment>(options);
  return {
    get since() {
      return work.since;
    },
    get at() {
      return work.at;
    },
    get playing() {
      return work.since !== undefined;
    },
    update: (moment, now) => {
      const copied = moment !== null && typeof moment === "object" ? { ...moment } : moment;
      return work.update(copied, now);
    },
    pose: () => {
      const pose = work.pose();
      if (pose !== undefined) rig.applyPose(pose, freeArms(rig));
    },
  };
}
