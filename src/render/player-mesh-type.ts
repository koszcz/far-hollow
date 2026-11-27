import type * as THREE from "three";
import type { CarriedLog, ReachHeight } from "../sim/entities";
import type { RopeHold } from "./sled-rope";
import type { SitBody } from "./sit-animation";
import type { MotionId, MotionMoment } from "./player-motions/motion-list";

export interface PlayerMesh {
  /** Place this at the player's feet. */
  readonly group: THREE.Group;
  /** Turns the player to face along a direction on the ground, in radians from the +z axis toward +x. */
  setHeading(radians: number): void;
  /** Shows the log or debarked log on the player's shoulder, or hides it when given undefined. */
  setCarryingLog(carrying: CarriedLog | undefined): void;
  /** Moves the legs and arms in step. Pass the total metres walked so far, or undefined to stand still. */
  setWalking(walkedMetres: number | undefined): void;
  /** Swings the player as if chopping. Pass undefined to stand upright. `nowSeconds` is a steady real-time clock. */
  setChopping(nowSeconds: number | undefined): void;
  /** Lifts the axe overhead and drops it as if splitting a log. Pass undefined to stand upright. `nowSeconds` is a steady real-time clock. */
  setSplitting(nowSeconds: number | undefined): void;
  /**
   * Lies the player down to sleep, and gets them up again, as sleep-animation.ts times it. Pass the seconds since the
   * player reached the bedroll, or undefined while not sleeping.
   */
  setSleeping(seconds: number | undefined): void;
  /**
   * Sits the player down on a stool, rests there, or stands them up, as sit-animation.ts times it.
   * Pass which clip shows and how far into it, or undefined while not sitting.
   */
  setSitting(body: SitBody | undefined): void;
  /**
   * Bends down, or reaches out at waist height, to pick something up or put it down. Pass the seconds since the reach
   * began, from 0 to REACH_SECONDS, or undefined while not reaching. The hand gets to the thing at HAND_AT_SECONDS.
   * `distance` is how far the thing is in front of the player's feet, in metres, if known. The hand reaches toward it.
   */
  setReaching(reach: { height: ReachHeight; seconds: number; distance?: number } | undefined): void;
  /**
   * Moves the motion `id`, from the list in player-motions/motion-list.ts, on to `moment`, or stops it when `moment` is
   * undefined. Each motion's module says what its moment is.
   */
  setMotion<Id extends MotionId>(id: Id, moment: MotionMoment<Id> | undefined): void;
  /** Where the player holds the sled's rope, as world points, while dragging. Undefined while not dragging. See sled-drag-animation.ts. */
  ropeHold(): RopeHold | undefined;
  /**
   * Copies where the lit torch's flame is, as a world point, into `target.position`, and how high it is above the player's feet
   * into `target.aboveGroundMetres`. Returns false, and copies nothing, while no torch shows. See player-motions/torch.ts.
   */
  torchFlame(target: { readonly position: THREE.Vector3; aboveGroundMetres: number }): boolean;
  dispose(): void;
}
