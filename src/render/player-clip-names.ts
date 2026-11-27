import type { ReachHeight } from "../sim/entities";

// The names of the KayKit clips the player mesh plays, as they are in the loaded file.
export const IDLE_CLIP = "Idle";
export const WALK_CLIP = "Running_A";
export const CHOP_CLIP = "2H_Melee_Attack_Slice";
export const SPLIT_CLIP = "2H_Melee_Attack_Chop";
export const LIE_DOWN_CLIP = "Lie_Down";
export const LIE_IDLE_CLIP = "Lie_Idle";
export const STAND_UP_CLIP = "Lie_StandUp";
/** The clip that lies the body flat on its back. KayKit made it as a death pose. Here it is the sleeping pose. */
export const ON_BACK_CLIP = "Death_A_Pose";
/** The clips for sitting down on a stool, resting there, and standing up: the approved "sit-animation". */
export const SIT_CLIPS = { sitDown: "Sit_Chair_Down", sitIdle: "Sit_Chair_Idle", standUp: "Sit_Chair_StandUp" } as const;
/** The clips for reaching to the ground, and out at waist height. */
export const REACH_CLIPS: Readonly<Record<ReachHeight, string>> = { low: "PickUp", waist: "Interact" };
/** The clip that holds both arms still while the right hand steadies a log on the shoulder. */
export const CARRY_CLIP = "Walking_B";
